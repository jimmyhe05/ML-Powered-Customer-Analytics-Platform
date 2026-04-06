import React from "react";
import { Container, Row, Col } from "react-bootstrap";

export default function TermsOfService() {
  const brandColor = "#c3d831";

  return (
    <Container className="py-5">
      <Row>
        <Col lg={10} className="mx-auto">
          <h1 className="mb-4" style={{ color: brandColor }}>
            Terms of Service
          </h1>
          <div className="content">
            <section className="mb-4">
              <h2 className="h4 mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing and using the Nuu Mobile training platform, you
                agree to be bound by these Terms of Service. If you do not agree
                with any part of these terms, please do not use our services.
              </p>
            </section>

            <section className="mb-4">
              <h2 className="h4 mb-3">2. Use License</h2>
              <p>
                Permission is granted to temporarily access the training
                materials for personal, non-commercial use only. This license
                does not include:
              </p>
              <ul>
                <li>Modifying or copying the materials</li>
                <li>Using the materials for commercial purposes</li>
                <li>
                  Attempting to decompile or reverse engineer any software
                </li>
                <li>Removing any copyright or proprietary notations</li>
              </ul>
            </section>

            <section className="mb-4">
              <h2 className="h4 mb-3">3. User Responsibilities</h2>
              <p>As a user of our platform, you agree to:</p>
              <ul>
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account</li>
                <li>Not share your account credentials</li>
                <li>Use the platform in compliance with applicable laws</li>
              </ul>
            </section>

            <section className="mb-4">
              <h2 className="h4 mb-3">4. Intellectual Property</h2>
              <p>
                All content, features, and functionality of the Nuu Mobile
                platform, including but not limited to text, graphics, logos,
                and software, are the exclusive property of Nuu Mobile and are
                protected by international copyright, trademark, and other
                intellectual property laws.
              </p>
            </section>

            <section className="mb-4">
              <h2 className="h4 mb-3">5. Disclaimer</h2>
              <p>
                The materials on the Nuu Mobile platform are provided on an
                &quot;as is&quot; basis. Nuu Mobile makes no warranties,
                expressed or implied, and hereby disclaims and negates all other
                warranties including, without limitation, implied warranties or
                conditions of merchantability, fitness for a particular purpose,
                or non-infringement of intellectual property or other violation
                of rights.
              </p>
            </section>

            <section className="mb-4">
              <h2 className="h4 mb-3">6. Limitations</h2>
              <p>
                In no event shall Nuu Mobile or its suppliers be liable for any
                damages (including, without limitation, damages for loss of data
                or profit, or due to business interruption) arising out of the
                use or inability to use the materials on the platform.
              </p>
            </section>

            <section className="mb-4">
              <h2 className="h4 mb-3">7. Contact Information</h2>
              <p>
                For any questions regarding these Terms of Service, please
                contact us at:
                <br />
                <a
                  href="mailto:legal@nuumobile.com"
                  style={{ color: brandColor }}
                >
                  legal@nuumobile.com
                </a>
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
