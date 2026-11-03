import "./FooterHome.css";

/**
 * ByteBud: footer for the buyer site (about, warranty policy, contact).
 * The link targets and contact details are placeholders: replace them with your real pages and info.
 */
export default function Footer ({
  logoSrc,
  contactEmail = "support@bytebud.example",
  contactPhone = "+63 000 000 0000",
  location = "Cagayan de Oro, Philippines",
}) {
  return (
    <footer className="bb-footer">
      <div className="bb-footer-inner">
        <div className="bb-footer-col bb-footer-about">
          <div className="bb-footer-brand">
            {logoSrc ? (
              <img className="bb-footer-logo" src={logoSrc} alt="" />
            ) : (
              <span className="bb-footer-logo-placeholder" aria-hidden="true">
                LOGO
              </span>
            )}
            <span className="bb-footer-name">ByteBud</span>
          </div>
          <p>
            Tested and graded refurbished laptops from surplus corporate stock, matched to what you study and priced
            for students.
          </p>
        </div>

        <div className="bb-footer-col">
          <h3>About</h3>
          <ul>
            <li><a href="/about">About ByteBud</a></li>
            <li><a href="/about#grading">How grading works</a></li>
            <li><a href="/about#student-pricing">Student pricing</a></li>
          </ul>
        </div>

        <div className="bb-footer-col">
          <h3>Warranty</h3>
          <ul>
            <li><a href="/warranty">Warranty policy</a></li>
            <li><a href="/warranty#claims">How to file a claim</a></li>
            <li><a href="/warranty#returns">Returns</a></li>
          </ul>
        </div>

        <div className="bb-footer-col">
          <h3>Contact</h3>
          <ul>
            <li><a href={`mailto:${contactEmail}`}>{contactEmail}</a></li>
            <li>{contactPhone}</li>
            <li>{location}</li>
          </ul>
        </div>
      </div>

      <div className="bb-footer-bottom">
        <span>&copy; {new Date().getFullYear()} ByteBud. All rights reserved.</span>
      </div>
    </footer>
  );
}