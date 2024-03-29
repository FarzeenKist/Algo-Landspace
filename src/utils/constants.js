import algosdk from "algosdk";
import MyAlgoConnect from "@randlabs/myalgo-connect";

const config = {
    algodToken: "",
    algodServer: "https://node.testnet.algoexplorerapi.io",
    algodPort: "",
    indexerToken: "",
    indexerServer: "https://algoindexer.testnet.algoexplorerapi.io",
    indexerPort: "",
}

export const algodClient = new algosdk.Algodv2(config.algodToken, config.algodServer, config.algodPort)

export const indexerClient = new algosdk.Indexer(config.indexerToken, config.indexerServer, config.indexerPort);

export const myAlgoConnect = new MyAlgoConnect({
    timeout: 100000000,
});

export const minRound = 27495012;


export const marketplaceNote = "aucspace:uv1"

// Maximum local storage allocation, immutable
export const numLocalInts = 0; 
export const numLocalBytes = 0;
// Maximum global storage allocation, immutable
export const numGlobalInts = 5; // Global variables stored as Int: startingPrice, instantPrice, currentBid, ended, endAt
export const numGlobalBytes = 4; // Global variables stored as Bytes: name, description, image, currentBidder

export const ALGORAND_DECIMALS = 6;
