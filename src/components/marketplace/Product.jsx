import React, { useState } from "react";
import { Card, Button, Col, Badge, Stack, Form } from "react-bootstrap";
import {
	microAlgosToString,
	stringToMicroAlgos,
	truncateAddress,
} from "../../utils/conversions";
import Identicon from "../utils/Identicon";

const Product = ({
	address,
	product,
	bidLand,
	buyLand,
	endAuction
}) => {
	const {
		name,
		image,
		description,
		instantPrice,
		startingPrice,
		currentBid,
		currentBidder,
		ended,
		endAt,
		appId,
		seller,
	} = product;
	let date = new Date().getTime() / 1000;
	const [newBid, setNewBid] = useState("");
	return (
		<Col key={appId}>
			<Card className=" h-100">
				<Card.Header>
					<Stack direction="horizontal" gap={2}>
						<Identicon size={28} address={seller} />
						<Badge bg="secondary" className="ms-auto">
							{ended ? "Not Available" : "Available"}
						</Badge>
					</Stack>
				</Card.Header>
				<div className=" ratio ratio-4x3">
					<img
						src={image}
						alt={name}
						style={{ objectFit: "cover" }}
					/>
				</div>
				<Card.Body className="d-flex  flex-column text-center">
					<Card.Title>{name}</Card.Title>
					<Card.Text className="flex-grow-1 ">
						{description}
					</Card.Text>
					<Card.Text className="text-secondary">
						<span>
							startingPrice is {microAlgosToString(startingPrice)}{" "}
							ALGO
						</span>
					</Card.Text>
					{!ended &&
					address !== seller &&
					address !== currentBidder &&
					endAt > date ? (
						<>
							<Form.Group className="mb-3" controlId="BidAmount">
								<Form.Label>
									Enter Bid(current bid is{" "}
									{microAlgosToString(currentBid)} ALGO) by{" "}
									{truncateAddress(currentBidder)}
								</Form.Label>
								<Form.Control
									type="text"
									placeholder="Enter bid amount"
									value={newBid}
									onChange={(e) =>
										setNewBid(
											e.target.value
										)
									}
								/>
								<Button
									variant="outline-success"
									onClick={() => bidLand(product, stringToMicroAlgos(newBid))}
									className="mt-2 px-5"
								>
									Bid(ends at {(endAt - date) / 60} minutes)
								</Button>
							</Form.Group>
							<Button
								variant="outline-dark"
								onClick={() => buyLand(product)}
								className="w-100 py-3"
							>
								Buy Instantly for{" "}
								{microAlgosToString(instantPrice)} ALGO
							</Button>
						</>
					) : (
						<Card.Text>Current Bid is {currentBid} by {truncateAddress(currentBidder)}</Card.Text>
					)}
					{address === seller && !ended && endAt < date ? (
						<Button variant="danger" onClick={() => endAuction(product)}>
							End Auction
						</Button>
					) : (
						""
					)}
					{currentBidder !== "" && ended ? (
						<Card.Text>
							Winner of the auction is{" "}
							{truncateAddress(currentBidder)}
						</Card.Text>
					) : (
						""
					)}
				</Card.Body>
			</Card>
		</Col>
	);
};

export default Product;
