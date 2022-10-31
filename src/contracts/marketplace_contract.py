from pyteal import *


class Product:
    class GlobalVariables:
        name = Bytes("name")
        image = Bytes("image")
        description = Bytes("description")
        startingPrice = Bytes("price")
        instantPrice = Bytes("instantPrice")
        currentBid = Bytes("currentbid")
        currentBidder = Bytes("currentBidder")
        ended = Bytes("ended")
        endAt = Bytes("endAt")

    class LocalVariables:
        dueAmount = Bytes("dueAmount")

    class AppMethods:
        bid = Bytes("bid")
        buy = Bytes("buy")
        end = Bytes("end")
        withdraw = Bytes("withdraw")

    def application_creation(self):
        return Seq([
            Assert(
                And(
                    Txn.application_args.length() == Int(6),
                    Txn.note() == Bytes("AucSpaceTest:uv1"),
                    Len(Txn.application_args[0]) > Int(0),
                    Len(Txn.application_args[1]) > Int(0),
                    Len(Txn.application_args[2]) > Int(0),
                    Btoi(Txn.application_args[3]) > Int(0),
                    Btoi(Txn.application_args[4]) > Int(0),
                )
            ),

            App.globalPut(self.GlobalVariables.name, Txn.application_args[0]),
            App.globalPut(self.GlobalVariables.image, Txn.application_args[1]),
            App.globalPut(self.GlobalVariables.description,
                          Txn.application_args[2]),
            App.globalPut(self.GlobalVariables.startingPrice,
                          Btoi(Txn.application_args[3])),
            App.globalPut(self.GlobalVariables.instantPrice,
                          Btoi(Txn.application_args[4])),
            App.globalPut(self.GlobalVariables.currentBid, Int(0)),
            App.globalPut(self.GlobalVariables.currentBidder, Bytes("")),
            App.globalPut(self.GlobalVariables.ended, Int(0)),
            App.globalPut(self.GlobalVariables.endAt,
                          Global.latest_timestamp() + Int(300)),
            Approve()
        ])
    @Subroutine(TealType.none)
    def payUser(user: Expr, amount: Expr):
        return Seq(
            InnerTxnBuilder.Begin(),
            InnerTxnBuilder.SetFields(
                {
                    TxnField.type_enum: TxnType.Payment,
                    TxnField.amount: amount - Global.min_txn_fee(),
                    TxnField.receiver: user,
                }
            ),
            InnerTxnBuilder.Submit(),
        )

    def bid(self):

        userBidAmount = ScratchVar(TealType.uint64)
        valid_number_of_transactions = Global.group_size() == Int(2)
        valid_transaction_params = And(
            Gtxn[1].type_enum() == TxnType.Payment,
            Gtxn[1].receiver() == Global.creator_address(),
            Gtxn[1].sender() == Gtxn[0].sender(),
        )

        valid_bid_params = And(
            App.optedIn(Int(0), Int(0)),
            Gtxn[0].sender() != Global.creator_address(),
            App.globalGet(self.GlobalVariables.ended) == Int(0),
            App.globalGet(
                self.GlobalVariables.endAt) > Global.latest_timestamp(),
            App.globalGet(self.GlobalVariables.currentBidder) != Txn.sender(),
            App.globalGet(
                self.GlobalVariables.startingPrice) <= Gtxn[1].amount(),
            App.globalGet(
                self.GlobalVariables.currentBid) < userBidAmount.load(),
        )

        can_bid = And(valid_number_of_transactions,
                      valid_transaction_params,
                      valid_bid_params)

        update_state = Seq([
            userBidAmount.store(App.localGet(
                Int(0), self.LocalVariables.dueAmount) + Gtxn[1].amount()),
            Assert(can_bid),
            App.globalPut(self.GlobalVariables.currentBidder,
                          Gtxn[0].sender()),
            App.globalPut(self.GlobalVariables.currentBid,
                          userBidAmount.load()),
            App.localPut(Int(0), self.LocalVariables.dueAmount, Int(0)),
            Approve()
        ])

        return update_state

    def buy(self):

        valid_number_of_transactions = Global.group_size() == Int(2)

        valid_transaction_params = And(
            Gtxn[1].type_enum() == TxnType.Payment,
            Gtxn[1].receiver() == Global.creator_address(),
            Gtxn[1].sender() == Gtxn[0].sender(),
            Gtxn[1].amount() == App.globalGet(
                self.GlobalVariables.instantPrice),
        )

        valid_buy_params = And(
            App.optedIn(Int(0), Int(0)),
            Gtxn[0].sender() != Global.creator_address(),
            App.globalGet(self.GlobalVariables.ended) == Int(0),
            App.globalGet(
                self.GlobalVariables.endAt) > Global.latest_timestamp(),
            App.globalGet(self.GlobalVariables.currentBid) < App.globalGet(
                self.GlobalVariables.instantPrice),
        )

        can_buy = And(valid_number_of_transactions,
                      valid_transaction_params,
                      valid_buy_params)

        update_state = Seq([
            If(Len(App.globalGet(self.GlobalVariables.currentBidder)) > Int(0), App.localPut(App.globalGet(
                self.GlobalVariables.currentBidder), self.LocalVariables.dueAmount, App.globalGet(self.GlobalVariables.currentBid))),
            App.globalPut(self.GlobalVariables.currentBidder, Txn.sender()),
            App.globalPut(self.GlobalVariables.currentBid, Gtxn[1].amount()),
            App.globalPut(self.GlobalVariables.ended, Int(1)),
            Approve()
        ])

        return If(can_buy).Then(update_state).Else(Reject())


    def end(self):
        valid_end_params = And(
            Txn.sender() == Global.creator_address(),
            App.globalGet(self.GlobalVariables.ended) == Int(0),
            App.globalGet(
                self.GlobalVariables.endAt) < Global.latest_timestamp(),
        )
        payCreator = Seq([
                App.globalPut(self.GlobalVariables.ended, Int(1)),
                self.payUser(Int(0), App.globalGet(
                    self.GlobalVariables.currentBid)),
                Approve()
            ])
        endAuction = Seq([
                App.globalPut(self.GlobalVariables.ended, Int(1)),
                Approve()
            ]) 
        return If(App.globalGet(self.GlobalVariables.currentBid) > App.globalGet(self.GlobalVariables.startingPrice)).Then(payCreator).Else(endAuction)
            

    def withdraw(self):
        valid_withdraw_params = And(
            App.optedIn(Int(0), Int(0)),
            App.localGet(Int(0), self.LocalVariables.dueAmount) > Int(0),
        )

        return Seq([
            self.payUser(Int(0), App.localGet(
                Int(0), self.LocalVariables.dueAmount)),
            App.localPut(Int(0), self.LocalVariables.dueAmount, Int(0)),
            Approve()
        ])
        
    def application_deletion(self):
        return Return(Txn.sender() == Global.creator_address())

    def application_start(self):
        return Cond(
            [Txn.application_id() == Int(0), self.application_creation()],
            [Txn.on_completion() == OnComplete.DeleteApplication,
             self.application_deletion()],
            [Txn.application_args[0] == self.AppMethods.buy, self.buy()],
            [Txn.application_args[0] == self.AppMethods.bid, self.bid()],
            [Txn.application_args[0] == self.AppMethods.end, self.end()],
            [Txn.application_args[0] == self.AppMethods.withdraw, self.withdraw()]
        )

    def approval_program(self):
        return self.application_start()

    def clear_program(self):
        return Return(Int(1))
