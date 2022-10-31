
import React, { useState } from "react";
import { Card, Button, Col, Badge, Stack, Form } from "react-bootstrap";
import {microAlgosToString, truncateAddress} from "../../utils/conversions";
import Identicon from "../utils/Identicon";

const Product = ({address, product, bidLand, buyLand, withdraw, endAuction, deleteLand }) => {
    const {name, image, description, instantPrice, startingPrice, currentBid, currentBidder, ended, endAt, sold, appId, seller} =
        product;
    return (
        <Col key={appId}>
			<Card className=" h-100">
				<Card.Header>
					<Stack direction="horizontal" gap={2}>
                    <Identicon size={28} address={seller}/>
						<Badge bg="secondary" className="ms-auto">
							{sold ? "Not Available" : "Available"}
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
						<br></br>
						<i className="bi bi-geo-alt-fill">{location}</i>
					</Card.Text>
					{!sold && new Date() < endAt && accountId !== seller ? (
						<>
							<Form.Group className="mb-3" controlId="BidAmount">
								<Form.Label>
									Enter Bid(current bid is{" "}
									{microAlgosToString(currentBid)}{" "}
									NEAR) by {bidder}
								</Form.Label>
								<Form.Control
									type="text"
									placeholder="Enter bid amount"
									value={newBid}
									onChange={(e) => setNewBid(e.target.value)}
								/>
								<Button
									variant="outline-success"
									onClick={triggerBid}
									className="mt-2 px-5"
								>
									Bid(ends in {endsInHours}hours)
								</Button>
							</Form.Group>
							<Button
								variant="outline-dark"
								onClick={triggerBuy}
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
					{address === seller && !sold? (
						<Button variant="danger" onClick={triggerEndAuction}>End Auction</Button>
					): ""}
				</Card.Body>
			</Card>
		</Col>
    );
};

export default Product;

