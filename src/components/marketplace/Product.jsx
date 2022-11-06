
import React, { useState } from "react";
import { Card, Button, Col, Badge, Stack, Form } from "react-bootstrap";
import {microAlgosToString, stringToMicroAlgos, truncateAddress} from "../../utils/conversions";
import Identicon from "../utils/Identicon";

const Product = ({address, product, bidLand, buyLand, withdraw, endAuction, deleteLand }) => {
    const {name, image, description, instantPrice, startingPrice, currentBid, currentBidder, ended, endAt, appId, seller} =
        product;

		const [newBid, setNewBid] = useState("");
    return (
        <Col key={appId}>
			<Card className=" h-100">
				<Card.Header>
					<Stack direction="horizontal" gap={2}>
                    <Identicon size={28} address={seller}/>
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
							startingPrice is{" "}
							{microAlgosToString(startingPrice)} NEAR
						</span>
					</Card.Text>
					{!ended && new Date() < endAt && address !== seller ? (
						<>
							<Form.Group className="mb-3" controlId="BidAmount">
								<Form.Label>
									Enter Bid(current bid is{" "}
									{microAlgosToString(currentBid)}{" "}
									NEAR) by {currentBidder}
								</Form.Label>
								<Form.Control
									type="text"
									placeholder="Enter bid amount"
									value={newBid}
									onChange={(e) => setNewBid(stringToMicroAlgos(e.target.value))}
								/>
								<Button
									variant="outline-success"
									onClick={bidLand}
									className="mt-2 px-5"
								>
									Bid(ends in {"lol"}hours)
								</Button>
							</Form.Group>
							<Button
								variant="outline-dark"
								onClick={buyLand}
								className="w-100 py-3"
							>
								Buy Instantly for{" "}
								{microAlgosToString(instantPrice)}{" "}
								NEAR
							</Button>
						</>
					) : (
						""
					)}
					{address === seller && !ended? (
						<Button variant="danger" onClick={endAuction}>End Auction</Button>
					): ""}
					{address !== seller? (
						<Button variant="success" onClick={withdraw}>Withdraw due amount</Button>
					) : ""}
				</Card.Body>
			</Card>
		</Col>
    );
};

export default Product;

