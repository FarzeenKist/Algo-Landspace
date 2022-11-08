from pyteal import *


class Land:
    class GlobalVariables:  # 5 global ints, 4 global bytes
        name = Bytes("NAME")  # bytes
        image = Bytes("IMAGE")  # bytes
        description = Bytes("DESCRIPTION")  # bytes
        startingPrice = Bytes("STARTINGPRICE")  # uint
        instantPrice = Bytes("INSTANTPRICE")  # uint
        currentBid = Bytes("CURRENTBID")  # uint
        currentBidder = Bytes("CURRENTBIDDER")  # bytes
        ended = Bytes("ENDED")  # uint
        endAt = Bytes("ENDAT")  # uint

    class LocalVariables:  # 1 local int
        dueAmount = Bytes("DUEAMOUNT")  # uint

    class AppMethods:
        bid = Bytes("bid")
        buy = Bytes("buy")
        end = Bytes("end")
        withdraw = Bytes("withdraw")

    # This function creates a new land listing
    def application_creation(self):
        return Seq([
            Assert(
                # Checks the following;
                # The number of application arguments is 6
                # - name, image, description, startingPrice, instantPrice, bid period in seconds
                # The attached txn note is "AucSpaceTest:uv1"
                # The txn arguments are valid values, i.e ints greater than zero and the bytes are not empty.
                And(
                    Txn.application_args.length() == Int(6),
                    Txn.note() == Bytes("AucSpaceTest:uv1"),
                    Len(Txn.application_args[0]) > Int(0),
                    Len(Txn.application_args[1]) > Int(0),
                    Len(Txn.application_args[2]) > Int(0),
                    Btoi(Txn.application_args[3]) > Int(0),
                    Btoi(Txn.application_args[4]) > Int(0),
                    Btoi(Txn.application_args[5]) < Int(0)
                )
            ),

            # store txn arguments in global state
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
                          Global.latest_timestamp() + Btoi(Txn.application_args[5])),
            Approve()
        ])

    # This function subscribes users to the application
    def opt_in(self):
        return Seq([
            # intialise user due amount to 0
            App.localPut(Txn.accounts[0],
                         self.LocalVariables.dueAmount, Int(0)),
            Approve()
        ])

    # Created for sending payments
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

    # This function allows users to place bids
    def bid(self):
        userBidAmount = ScratchVar(TealType.uint64)
        currentBidder = App.globalGet(self.GlobalVariables.currentBidder)
        currentBid = App.globalGet(self.GlobalVariables.currentBid)

        # check that this txn is a grouped txn with two txns
        valid_number_of_transactions = Global.group_size() == Int(2)

        # checks transaction params and payment params.
        valid_transaction_params = And(
            # - The current bidder address is passed in the txn accounts array
            Txn.accounts.length() == Int(1),
            Txn.accounts[1] == currentBidder,

            # - Sanity checks for payment txn.
            Gtxn[1].type_enum() == TxnType.Payment,
            Gtxn[1].receiver() == Global.current_application_address(),
            Gtxn[1].sender() == Gtxn[0].sender(),
        )

        # checks to validate user bid
        valid_bid_params = And(
            # - User has opted in
            App.optedIn(Txn.accounts[0], Txn.applications[0]),

            # - User is not creator
            Gtxn[0].sender() != Global.creator_address(),

            # - Bidding period has not ended
            App.globalGet(self.GlobalVariables.ended) == Int(0),

            App.globalGet(
                self.GlobalVariables.endAt) > Global.latest_timestamp(),

            # - User is not the current bidder
            currentBidder != Txn.sender(),

            # - User Bid is greater than starting price
            App.globalGet(
                self.GlobalVariables.startingPrice) <= Gtxn[1].amount(),

            # - User Bid is greater than the currrent bid
            currentBid < userBidAmount.load(),
        )

        # user can bid if all checks validate
        can_bid = And(valid_number_of_transactions,
                      valid_transaction_params,
                      valid_bid_params)

        return Seq([
            # updates user bid in localstorage
            userBidAmount.store(
                App.localGet(
                    Txn.accounts[0], self.LocalVariables.dueAmount) + Gtxn[1].amount()
            ),

            # checks if user can bid
            Assert(can_bid),

            # update the previous "current" bidder's due amount with his with previous bid which was the previous valid bid.
            App.localPut(
                Txn.accounts[1], self.LocalVariables.dueAmount, currentBid),

            # update the global storage with new current bidder and current bid
            App.globalPut(
                self.GlobalVariables.currentBidder,
                Gtxn[0].sender()
            ),
            App.globalPut(
                self.GlobalVariables.currentBid,
                userBidAmount.load()
            ),

            # update user due amount in storage to zero, as user bid is valid
            App.localPut(
                Txn.accounts[0], self.LocalVariables.dueAmount, Int(0)),

            Approve()
        ])

    # This function allows users to buy the listing instantly without bidding
    def buy(self):
        currentBidder = App.globalGet(self.GlobalVariables.currentBidder)
        currentBid = App.globalGet(self.GlobalVariables.currentBid)

        # check that this txn is a grouped txn with two txns
        valid_number_of_transactions = Global.group_size() == Int(2)

        # payment checks
        valid_transaction_params = And(
            Gtxn[1].type_enum() == TxnType.Payment,
            Gtxn[1].receiver() == Global.creator_address(),
            Gtxn[1].sender() == Gtxn[0].sender(),
            Gtxn[1].amount() == App.globalGet(
                self.GlobalVariables.instantPrice),
        )

        # checks to validate buy conditions
        valid_buy_params = And(
            # - User has opted in
            App.optedIn(Txn.accounts[0], Txn.applications[0]),

            # - User is not creator
            Gtxn[0].sender() != Global.creator_address(),

            # - Bidding period has not ended
            App.globalGet(self.GlobalVariables.ended) == Int(0),
            App.globalGet(
                self.GlobalVariables.endAt) > Global.latest_timestamp(),

            # - that the current bid is not greater than the instant buy price
            currentBid < App.globalGet(
                self.GlobalVariables.instantPrice),
        )

        # user can buy if all checks validate
        can_buy = And(valid_number_of_transactions,
                      valid_transaction_params,
                      valid_buy_params)

        update_state = Seq([
            # check if there is a current Bidder,
            # then update the current bidder's due amount with his with previous bid which was the current then.
            If(Len(currentBidder) > Int(0))
            .Then(
                App.localPut(
                    currentBidder,
                    self.LocalVariables.dueAmount,
                    currentBid
                )
            ),

            # update the global storage current bidder and current bid
            App.globalPut(self.GlobalVariables.currentBidder, Txn.sender()),
            App.globalPut(self.GlobalVariables.currentBid, Gtxn[1].amount()),

            # mark bidding session as ended
            App.globalPut(self.GlobalVariables.ended, Int(1)),
            Approve()
        ])

        return If(can_buy).Then(update_state).Else(Reject())

    # This function ends the auction
    def end(self):
        return Seq([
            Assert(
                # Checks that
                # - the txn sender is the creator
                # - Bidding period has ended
                And(
                    Txn.sender() == Global.creator_address(),
                    App.globalGet(self.GlobalVariables.ended) == Int(0),
                    App.globalGet(
                        self.GlobalVariables.endAt) < Global.latest_timestamp(),
                )
            ),

            # check if there is a valid bid.
            If(App.globalGet(self.GlobalVariables.currentBid) > App.globalGet(
                self.GlobalVariables.startingPrice))
            .Then(
                # send bid to creator
                self.payUser(Txn.accounts[0], App.globalGet(
                    self.GlobalVariables.currentBid)),
            ),

            # mark bidding session as ended
            App.globalPut(self.GlobalVariables.ended, Int(1)),

            Approve()
        ])

    # This function allows users to withdraw their bids
    def withdraw(self):
        user_due_amount = App.localGet(
            Txn.accounts[0], self.LocalVariables.dueAmount)
        # checks
        valid_withdraw_params = And(
            # - User has opted in
            App.optedIn(Txn.accounts[0], Txn.applications[0]),
            # - User has due amount in the local storage
            user_due_amount > Int(0),

            # - Bidding period has ended
            App.globalGet(self.GlobalVariables.ended) == Int(1),
            App.globalGet(
                self.GlobalVariables.endAt) < Global.latest_timestamp(),
        )

        payout_user = Seq([
            # send amount to user
            self.payUser(Txn.accounts[0], user_due_amount),

            # set user due amount to zero
            App.localPut(
                Txn.accounts[0],
                self.LocalVariables.dueAmount,
                Int(0)
            ),
            Approve()
        ])

        return If(valid_withdraw_params).Then(payout_user).Else(Reject())

    def application_deletion(self):
        return Return(Txn.sender() == Global.creator_address())

    def application_start(self):
        return Cond(
            [Txn.application_id() == Int(0), self.application_creation()],
            [Txn.on_completion() == OnComplete.DeleteApplication,
             self.application_deletion()],
            [Txn.on_completion() == OnComplete.OptIn, self.opt_in()],
            [Txn.application_args[0] == self.AppMethods.buy, self.buy()],
            [Txn.application_args[0] == self.AppMethods.bid, self.bid()],
            [Txn.application_args[0] == self.AppMethods.end, self.end()],
            [Txn.application_args[0] == self.AppMethods.withdraw, self.withdraw()]
        )

    def approval_program(self):
        return self.application_start()

    def clear_program(self):
        return Return(Int(1))
