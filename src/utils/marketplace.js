import algosdk from "algosdk";
import {
	algodClient,
	indexerClient,
	marketplaceNote,
	minRound,
	myAlgoConnect,
	numGlobalBytes,
	numGlobalInts,
	numLocalBytes,
	numLocalInts,
} from "./constants";
import { Base64 } from "js-base64";
/* eslint import/no-webpack-loader-syntax: off */
import approvalProgram from "!!raw-loader!../contracts/marketplace_approval.teal";
import clearProgram from "!!raw-loader!../contracts/marketplace_clear.teal";
import { base64ToUTF8String, stringToMicroAlgos, utf8ToBase64String } from "./conversions";

class Product {
	constructor(
		name,
		image,
		description,
		startingPrice,
		instantPrice,
		currentBid,
		currentBidder,
		ended,
		endAt,
		appId,
		seller
	) {
		this.name = name;
		this.image = image;
		this.description = description;
		this.startingPrice = startingPrice;
		this.instantPrice = instantPrice;
		this.currentBid = currentBid;
		this.currentBidder = currentBidder;
		this.ended = ended;
		this.endAt = endAt;
		this.appId = appId;
		this.seller = seller;
	}
}

// Compile smart contract in .teal format to program
const compileProgram = async (programSource) => {
	let encoder = new TextEncoder();
	let programBytes = encoder.encode(programSource);
	let compileResponse = await algodClient.compile(programBytes).do();
	return new Uint8Array(Buffer.from(compileResponse.result, "base64"));
};


// CREATE PRODUCT: ApplicationCreateTxn
export const createProductAction = async (senderAddress, product) => {
	console.log("Adding land...", product);

	let params = await algodClient.getTransactionParams().do();

	// Compile programs
	const compiledApprovalProgram = await compileProgram(approvalProgram);
	const compiledClearProgram = await compileProgram(clearProgram);

	// Build note to identify transaction later and required app args as Uint8Arrays
	let note = new TextEncoder().encode(marketplaceNote);
	let name = new TextEncoder().encode(product.name);
	let image = new TextEncoder().encode(product.image);
	let description = new TextEncoder().encode(product.description);
	let startingPrice = algosdk.encodeUint64(product.startingPrice);
	let instantPrice = algosdk.encodeUint64(product.instantPrice);

	let appArgs = [name, image, description, startingPrice, instantPrice];
	// Create ApplicationCreateTxn
	let txn = algosdk.makeApplicationCreateTxnFromObject({
		from: senderAddress,
		suggestedParams: params,
		onComplete: algosdk.OnApplicationComplete.NoOpOC,
		approvalProgram: compiledApprovalProgram,
		clearProgram: compiledClearProgram,
		numLocalInts: numLocalInts,
		numLocalByteSlices: numLocalBytes,
		numGlobalInts: numGlobalInts,
		numGlobalByteSlices: numGlobalBytes,
		note: note,
		appArgs: appArgs,
	});

	// Get transaction ID
	let txId = txn.txID().toString();

	// Sign & submit the transaction
	let signedTxn = await myAlgoConnect.signTransaction(txn.toByte());
	console.log("Signed transaction with txID: %s", txId);
	await algodClient.sendRawTransaction(signedTxn.blob).do();

	console.log("before confirmation");
	// Wait for transaction to be confirmed
	let confirmedTxn = await algosdk.waitForConfirmation(algodClient, txId, 4);

	// Get the completed Transaction
	console.log(
		"Transaction " +
			txId +
			" confirmed in round " +
			confirmedTxn["confirmed-round"]
	);

	// Get created application id and notify about completion
	let transactionResponse = await algodClient
		.pendingTransactionInformation(txId)
		.do();
	let appId = transactionResponse["application-index"];

	// Create PaymentTxn
	let paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
		from: senderAddress,
		to: algosdk.getApplicationAddress(appId),
		amount: stringToMicroAlgos("2"),
		suggestedParams: params,
	});

	// Get transaction ID
	let txId2 = paymentTxn.txID().toString();

	// Sign & submit the transaction
	let signedTxn2 = await myAlgoConnect.signTransaction(paymentTxn.toByte());
	console.log("Signed transaction with txID: %s", txId2);
	await algodClient.sendRawTransaction(signedTxn2.blob).do();

	console.log("before confirmation");
	// Wait for transaction to be confirmed
	let confirmedTxn2 = await algosdk.waitForConfirmation(
		algodClient,
		txId2,
		4
	);
	console.log("Created new app-id: ", appId);
	return appId;
};

// Buy LAND: Group transaction consisting of ApplicationCallTxn and PaymentTxn
export const buyProductAction = async (senderAddress, product) => {
	console.log("Buying land...");
	let params = await algodClient.getTransactionParams().do();

	// Build required app args as Uint8Array
	let buyArg = new TextEncoder().encode("buy");
	let appArgs = [buyArg];
	let accounts = [product.currentBidder, product.seller];

	// Create ApplicationCallTxn
	let appCallTxn = algosdk.makeApplicationCallTxnFromObject({
		from: senderAddress,
		appIndex: product.appId,
		onComplete: algosdk.OnApplicationComplete.NoOpOC,
		suggestedParams: params,
		appArgs: appArgs,
		accounts: accounts,
	});

	// Create PaymentTxn
	let paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
		from: senderAddress,
		to: product.seller,
		amount: product.instantPrice,
		suggestedParams: params,
	});

	let txnArray = [appCallTxn, paymentTxn];

	// Create group transaction out of previously build transactions
	let groupID = algosdk.computeGroupID(txnArray);
	for (let i = 0; i < 2; i++) txnArray[i].group = groupID;

	// Sign & submit the group transaction
	let signedTxn = await myAlgoConnect.signTransaction(
		txnArray.map((txn) => txn.toByte())
	);
	console.log("Signed group transaction");
	let tx = await algodClient
		.sendRawTransaction(signedTxn.map((txn) => txn.blob))
		.do();

	// Wait for group transaction to be confirmed
	let confirmedTxn = await algosdk.waitForConfirmation(
		algodClient,
		tx.txId,
		4
	);

	// Notify about completion
	console.log(
		"Group transaction " +
			tx.txId +
			" confirmed in round " +
			confirmedTxn["confirmed-round"]
	);
};

// Bid LAND: Group transaction consisting of ApplicationCallTxn and PaymentTxn
export const bidLandAction = async (senderAddress, product, newBid) => {
	console.log("Bidding on product...");
	let params = await algodClient.getTransactionParams().do();

	// Build required app args as Uint8Array
	let bidArg = new TextEncoder().encode("bid");
	let appArgs = [bidArg];
	let accounts = [product.currentBidder];
	// Create ApplicationCallTxn
	let appCallTxn = algosdk.makeApplicationCallTxnFromObject({
		from: senderAddress,
		appIndex: product.appId,
		onComplete: algosdk.OnApplicationComplete.NoOpOC,
		suggestedParams: params,
		appArgs: appArgs,
		accounts: accounts,
	});

	// Create PaymentTxn
	let paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
		from: senderAddress,
		to: algosdk.getApplicationAddress(product.appId),
		amount: newBid,
		suggestedParams: params,
	});

	let txnArray = [appCallTxn, paymentTxn];

	// Create group transaction out of previously build transactions
	let groupID = algosdk.computeGroupID(txnArray);
	for (let i = 0; i < 2; i++) txnArray[i].group = groupID;

	// Sign & submit the group transaction
	let signedTxn = await myAlgoConnect.signTransaction(
		txnArray.map((txn) => txn.toByte())
	);
	console.log("Signed group transaction");
	let tx = await algodClient
		.sendRawTransaction(signedTxn.map((txn) => txn.blob))
		.do();

	// Wait for group transaction to be confirmed
	let confirmedTxn = await algosdk.waitForConfirmation(
		algodClient,
		tx.txId,
		4
	);

	// Notify about completion
	console.log(
		"Group transaction " +
			tx.txId +
			" confirmed in round " +
			confirmedTxn["confirmed-round"]
	);
};

export const endAuctionAction = async (senderAddress, product) => {
	console.log("Ending Auction...");
	let params = await algodClient.getTransactionParams().do();

	// Build required app args as Uint8Array
	let endArg = new TextEncoder().encode("end");
	let appArgs = [endArg];

	// Create ApplicationCallTxn
	let appCallTxn = algosdk.makeApplicationCallTxnFromObject({
		from: senderAddress,
		appIndex: product.appId,
		onComplete: algosdk.OnApplicationComplete.NoOpOC,
		suggestedParams: params,
		appArgs: appArgs,
	});

	// Get transaction ID
	let txId = appCallTxn.txID().toString();

	// Sign & submit the transaction
	let signedTxn = await myAlgoConnect.signTransaction(appCallTxn.toByte());
	console.log("Signed transaction with txID: %s", txId);
	await algodClient.sendRawTransaction(signedTxn.blob).do();

	// Wait for group transaction to be confirmed
	let confirmedTxn = await algosdk.waitForConfirmation(algodClient, txId, 4);

	// Notify about completion
	console.log(
		"Group transaction " +
			txId +
			" confirmed in round " +
			confirmedTxn["confirmed-round"]
	);
};


// DELETE PRODUCT: ApplicationDeleteTxn
export const deleteProductAction = async (senderAddress, index) => {
	console.log("Deleting application...");

	let params = await algodClient.getTransactionParams().do();

	// Create ApplicationDeleteTxn
	let txn = algosdk.makeApplicationDeleteTxnFromObject({
		from: senderAddress,
		suggestedParams: params,
		appIndex: index,
	});

	// Get transaction ID
	let txId = txn.txID().toString();

	// Sign & submit the transaction
	let signedTxn = await myAlgoConnect.signTransaction(txn.toByte());
	console.log("Signed transaction with txID: %s", txId);
	await algodClient.sendRawTransaction(signedTxn.blob).do();

	// Wait for transaction to be confirmed
	const confirmedTxn = await algosdk.waitForConfirmation(
		algodClient,
		txId,
		4
	);

	// Get the completed Transaction
	console.log(
		"Transaction " +
			txId +
			" confirmed in round " +
			confirmedTxn["confirmed-round"]
	);

	// Get application id of deleted application and notify about completion
	let transactionResponse = await algodClient
		.pendingTransactionInformation(txId)
		.do();
	let appId = transactionResponse["txn"]["txn"].apid;
	console.log("Deleted app-id: ", appId);
};

// GET LANDS: Use indexer
export const getProductsAction = async (senderAddress) => {
	console.log("Fetching lands...");
	let note = new TextEncoder().encode(marketplaceNote);
	let encodedNote = Buffer.from(note).toString("base64");

	// Step 1: Get all transactions by notePrefix (+ minRound filter for performance)
	let transactionInfo = await indexerClient
		.searchForTransactions()
		.notePrefix(encodedNote)
		.txType("appl")
		.minRound(minRound)
		.do();
	let products = [];
	for (const transaction of transactionInfo.transactions) {
		let appId = transaction["created-application-index"];
		if (appId) {
			// Step 2: Get each application by application id
			let product = await getApplication(appId, senderAddress);
			if (product) {
				products.push(product);
			}
		}
	}
	console.log("Lands fetched.");
	return products;
};

const getApplication = async (appId, senderAddress) => {
	try {
		// 1. Get application by appId
		let response = await indexerClient
			.lookupApplications(appId)
			.includeAll(true)
			.do();
		if (response.application.deleted) {
			return null;
		}
		let globalState = response.application.params["global-state"];

		// 2. Parse fields of response and return land
		let seller = response.application.params.creator;
		let name = "";
		let image = "";
		let description = "";
		let startingPrice = 0;
		let instantPrice = 0;
		let currentBid = 0;
		let currentBidder = "";
		let ended = null;
		let endAt = 0;

		const getField = (fieldName, globalState) => {
			return globalState.find((state) => {
				return state.key === utf8ToBase64String(fieldName);
			});
		};

		if (getField("NAME", globalState) !== undefined) {
			let field = getField("NAME", globalState).value.bytes;
			name = base64ToUTF8String(field);
		}

		if (getField("IMAGE", globalState) !== undefined) {
			let field = getField("IMAGE", globalState).value.bytes;
			image = base64ToUTF8String(field);
		}

		if (getField("DESCRIPTION", globalState) !== undefined) {
			let field = getField("DESCRIPTION", globalState).value.bytes;
			description = base64ToUTF8String(field);
		}

		if (getField("STARTINGPRICE", globalState) !== undefined) {
			startingPrice = getField("STARTINGPRICE", globalState).value.uint;
		}
		if (getField("INSTANTPRICE", globalState) !== undefined) {
			instantPrice = getField("INSTANTPRICE", globalState).value.uint;
		}
		if (getField("CURRENTBID", globalState) !== undefined) {
			currentBid = getField("CURRENTBID", globalState).value.uint;
		}
		if (getField("CURRENTBIDDER", globalState) !== undefined) {
			let field = getField("CURRENTBIDDER", globalState).value.bytes;
			currentBidder = algosdk.encodeAddress(Base64.toUint8Array(field));
		}
		if (getField("ENDED", globalState) !== undefined) {
			ended =
				getField("ENDED", globalState).value.uint > 0 ? true : false;
		}
		if (getField("ENDAT", globalState) !== undefined) {
			endAt = getField("ENDAT", globalState).value.uint;
		}

		return new Product(
			name,
			image,
			description,
			startingPrice,
			instantPrice,
			currentBid,
			currentBidder,
			ended,
			endAt,
			appId,
			seller
		);
	} catch (err) {
		return null;
	}
};
