import React, { useState } from "react";
import { Container, Row, Col, Form, Button, Alert } from "react-bootstrap";

export default function Contact() {
  const brandColor = "#c3d831";
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [showSuccess, setShowSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you would typically send the form data to your backend
    console.log("Form submitted:", formData);
    setShowSuccess(true);
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <Container className="py-5">
      <Row>
        <Col lg={10} className="mx-auto">
          <h1 className="mb-4" style={{ color: brandColor }}>
            Contact Us
          </h1>

          {showSuccess && (
            <Alert
              variant="success"
              onClose={() => setShowSuccess(false)}
              dismissible
            >
              Thank you for your message! We will get back to you soon.
            </Alert>
          )}

          <Row className="mt-4">
            <Col md={6}>
              <div className="mb-4">
                <h3 className="h5 mb-3">Get in Touch</h3>
                <p>
                  Have questions about our training platform? We&apos;re here to
                  help! Fill out the form or use our contact information below.
                </p>
              </div>

              <div className="mb-4">
                <h3 className="h5 mb-3">Contact Information</h3>
                <p>
                  <strong>Email:</strong>{" "}
                  <a
                    href="mailto:contact@nuumobile.com"
                    style={{ color: brandColor }}
                  >
                    contact@nuumobile.com
                  </a>
                </p>
                <p>
                  <strong>Phone:</strong> +1 (555) 123-4567
                </p>
                <p>
                  <strong>Address:</strong>
                  <br />
                  123 Training Street
                  <br />
                  Tech City, TC 12345
                </p>
              </div>

              <div>
                <h3 className="h5 mb-3">Business Hours</h3>
                <p>
                  Monday - Friday: 9:00 AM - 6:00 PM EST
                  <br />
                  Saturday: 10:00 AM - 4:00 PM EST
                  <br />
                  Sunday: Closed
                </p>
              </div>
            </Col>

            <Col md={6}>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Subject</Form.Label>
                  <Form.Control
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Message</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={5}
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>

                <Button
                  type="submit"
                  style={{
                    backgroundColor: brandColor,
                    border: "none",
                    padding: "0.5rem 2rem",
                  }}
                >
                  Send Message
                </Button>
              </Form>
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
}
