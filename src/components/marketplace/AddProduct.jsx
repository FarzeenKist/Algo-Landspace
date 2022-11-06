import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { Button, Modal, Form, FloatingLabel } from "react-bootstrap";
import { stringToMicroAlgos } from "../../utils/conversions";

const AddProduct = ({ createProduct }) => {
	const [name, setName] = useState("Villa One");
	const [image, setImage] = useState("https://www.oneandonlyresorts.com/-/media/oneandonly/le-saint-geran/accommodation/villa-one/oolsg-villa-one-living-room-1.jpg");
	const [description, setDescription] = useState("Description");
	const [startingPrice, setStartingPrice] = useState("");
	const [instantPrice, setInstantPrice] = useState("");

	const isFormFilled = useCallback(() => {
		return name && image && description && startingPrice > 0 && instantPrice;
	}, [
		name,
		image,
		description,
		startingPrice,
		instantPrice
	]);

	const [show, setShow] = useState(false);

	const handleClose = () => setShow(false);
	const handleShow = () => setShow(true);

	return (
		<>
			<Button
				onClick={handleShow}
				variant="dark"
				className="rounded-pill px-0"
				style={{ width: "38px" }}
			>
				<i className="bi bi-plus"></i>
			</Button>
			<Modal show={show} onHide={handleClose} centered>
				<Modal.Header closeButton>
					<Modal.Title>New Land</Modal.Title>
				</Modal.Header>
				<Form>
					<Modal.Body>
						<FloatingLabel
							controlId="inputName"
							label="Land/Home name"
							className="mb-3"
						>
							<Form.Control
								type="text"
								value={name}
								onChange={(e) => {
									setName(e.target.value);
								}}
								placeholder="Enter name of land/home"
							/>
						</FloatingLabel>
						<FloatingLabel
							controlId="inputUrl"
							label="Image URL"
							className="mb-3"
						>
							<Form.Control
								type="text"
								placeholder="Image URL"
								value={image}
								onChange={(e) => {
									setImage(e.target.value);
								}}
							/>
						</FloatingLabel>
						<FloatingLabel
							controlId="inputDescription"
							label="Description"
							className="mb-3"
						>
							<Form.Control
								as="textarea"
								placeholder="description"
								style={{ height: "80px" }}
								value={description}
								onChange={(e) => {
									setDescription(e.target.value);
								}}
							/>
						</FloatingLabel>
						<FloatingLabel
							controlId="inputInstantPrice"
							label="Instant Price"
							className="mb-3"
						>
							<Form.Control
								type="text"
								placeholder="Instant price"
								onChange={(e) => {
									setInstantPrice(
										stringToMicroAlgos(e.target.value)
									);
								}}
							/>
						</FloatingLabel>
						<FloatingLabel
							controlId="inputStartingPrice"
							label="Starting Price"
							className="mb-3"
						>
							<Form.Control
								type="text"
								placeholder="Starting price"
								onChange={(e) => {
									setStartingPrice(
										stringToMicroAlgos(e.target.value)
									);
								}}
							/>
						</FloatingLabel>
					</Modal.Body>
				</Form>
				<Modal.Footer>
					<Button variant="outline-secondary" onClick={handleClose}>
						Close
					</Button>
					<Button
						variant="dark"
						disabled={!isFormFilled()}
						onClick={() => {
							createProduct({
                                name,
                                image,
                                description,
                                startingPrice,
                                instantPrice
                            })
							handleClose();
						}}
					>
						Save Land
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

AddProduct.propTypes = {
	createProduct: PropTypes.func.isRequired,
};

export default AddProduct;
