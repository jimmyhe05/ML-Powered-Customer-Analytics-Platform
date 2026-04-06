import React from "react";
import { Container, Row, Col } from "react-bootstrap";

export default function PrivacyPolicy() {
  const brandColor = "#c3d831";

  return (
    <Container className="py-5">
      <Row>
        <Col lg={10} className="mx-auto">
          <h1 className="mb-4" style={{ color: brandColor }}>
            Privacy Policy
          </h1>
          <div className="content">
            <section className="mb-4">
              <h2 className="h4 mb-3">1. Information We Collect</h2>
              <p>
                We collect information that you provide directly to us when
                using our training platform, including but not limited to:
              </p>
              <ul>
                <li>Name and contact information</li>
                <li>Training progress and completion data</li>
                <li>Assessment results and performance metrics</li>
                <li>Communication preferences</li>
              </ul>
            </section>

            <section className="mb-4">
              <h2 className="h4 mb-3">2. How We Use Your Information</h2>
              <p>We use the collected information to:</p>
              <ul>
                <li>Provide and improve our training services</li>
                <li>Track your progress and performance</li>
                <li>Communicate with you about our services</li>
                <li>Ensure the security of our platform</li>
              </ul>
            </section>

            <section className="mb-4">
              <h2 className="h4 mb-3">3. Data Security</h2>
              <p>
                We implement appropriate security measures to protect your
                personal information from unauthorized access, alteration,
                disclosure, or destruction.
              </p>
            </section>

            <section className="mb-4">
              <h2 className="h4 mb-3">4. Your Rights</h2>
              <p>You have the right to:</p>
              <ul>
                <li>Access your personal information</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Opt-out of marketing communications</li>
              </ul>
            </section>

            <section className="mb-4">
              <h2 className="h4 mb-3">5. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please
                contact us at:
                <br />
                <a
                  href="mailto:privacy@nuumobile.com"
                  style={{ color: brandColor }}
                >
                  privacy@nuumobile.com
                </a>
              </p>
            </section>

            <section className="mb-4">
              <h2 className="h4 mb-3">6. Updates to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will
                notify you of any changes by posting the new Privacy Policy on
                this page and updating the "Last Updated" date.
              </p>
            </section>

            <div className="mt-4 text-muted">
              <p>Last Updated: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
