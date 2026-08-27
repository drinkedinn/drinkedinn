import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const UPDATED = 'February 2026';
const CONTACT = 'hello@drinkedinn.app';
const PRIVACY_CONTACT = 'privacy@drinkedinn.app';

const S = {
  page: { minHeight: '100vh', background: '#FBF8F2', color: '#1E1913', fontFamily: "'Inter', -apple-system, sans-serif" },
  bar: { borderBottom: '1px solid #E4DACA', background: '#fff', position: 'sticky', top: 0, zIndex: 10 },
  barIn: { maxWidth: 760, margin: '0 auto', padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  brand: { display: 'flex', alignItems: 'center', gap: 3, fontWeight: 800, fontSize: 19, letterSpacing: -0.4, cursor: 'pointer', background: 'none', border: 'none', color: '#1E1913', padding: 0 },
  chip: { background: 'linear-gradient(135deg,#2D6FC9,#4C8DE0)', color: '#fff', padding: '2px 8px', borderRadius: 6, fontWeight: 900 },
  nav: { display: 'flex', gap: 18 },
  navLink: { fontSize: 13.5, color: '#5D5343', textDecoration: 'none', fontWeight: 500 },
  navActive: { color: '#C8831F', fontWeight: 700 },
  wrap: { maxWidth: 760, margin: '0 auto', padding: '44px 22px 90px' },
  eyebrow: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#C8831F', margin: 0 },
  h1: { fontSize: 34, fontWeight: 800, letterSpacing: -0.7, margin: '12px 0 8px', lineHeight: 1.1 },
  updated: { color: '#8C8271', fontSize: 13.5, margin: '0 0 32px' },
  h2: { fontSize: 19, fontWeight: 700, letterSpacing: -0.2, margin: '34px 0 10px' },
  p: { fontSize: 15.5, lineHeight: 1.72, color: '#3D362B', margin: '0 0 14px' },
  ul: { margin: '0 0 14px', paddingLeft: 22 },
  li: { fontSize: 15.5, lineHeight: 1.72, color: '#3D362B', marginBottom: 7 },
  a: { color: '#A96A14', textDecorationThickness: 1, textUnderlineOffset: 3 },
  callout: { background: '#FDF6EA', border: '1px solid #F2CE8E', borderRadius: 12, padding: '16px 18px', margin: '0 0 26px' },
  calloutT: { fontWeight: 700, fontSize: 15, margin: '0 0 5px' },
  calloutP: { fontSize: 14.5, lineHeight: 1.65, color: '#5D5343', margin: 0 },
  foot: { borderTop: '1px solid #E4DACA', marginTop: 48, paddingTop: 20, fontSize: 13, color: '#8C8271' },
};

function Shell({ kind, eyebrow, title, children }) {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
    const previous = document.title;
    document.title = `${title} · DrinkedInn`;
    return () => { document.title = previous; };
  }, [kind, title]);

  const links = [
    { to: '/privacy', label: 'Privacy' },
    { to: '/terms', label: 'Terms' },
    { to: '/guidelines', label: 'Guidelines' },
  ];

  return (
    <div style={S.page}>
      <div style={S.bar}>
        <div style={S.barIn}>
          <button style={S.brand} onClick={() => navigate('/')}>
            Drinked<span style={S.chip}>Inn</span>
          </button>
          <nav style={S.nav}>
            {links.map((l) => (
              <a
                key={l.to}
                href={l.to}
                style={{ ...S.navLink, ...(l.to === `/${kind}` ? S.navActive : {}) }}
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <main style={S.wrap}>
        <p style={S.eyebrow}>{eyebrow}</p>
        <h1 style={S.h1}>{title}</h1>
        <p style={S.updated}>Last updated {UPDATED}</p>
        {children}
        <div style={S.foot}>
          DrinkedInn · 18+ only · Questions? <a href={`mailto:${CONTACT}`} style={S.a}>{CONTACT}</a>
        </div>
      </main>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <Shell kind="privacy" eyebrow="Legal" title="Privacy Policy">
      <div style={S.callout}>
        <p style={S.calloutT}>The short version</p>
        <p style={S.calloutP}>
          We collect what we need to run a social network and nothing more. We don't sell your data,
          we don't run third-party advertising trackers, and you can delete your account and all of
          its content from inside the app at any time.
        </p>
      </div>

      <h2 style={S.h2}>Who we are</h2>
      <p style={S.p}>
        DrinkedInn ("we", "us") operates the DrinkedInn website and mobile applications. This policy
        explains what personal data we collect, why, and what rights you have over it. Contact us at{' '}
        <a href={`mailto:${PRIVACY_CONTACT}`} style={S.a}>{PRIVACY_CONTACT}</a>.
      </p>

      <h2 style={S.h2}>What we collect</h2>
      <ul style={S.ul}>
        <li style={S.li}><strong>Account details</strong> — your name, email address, and date of birth. Date of birth is used once to confirm you meet the legal drinking age and is not shown publicly.</li>
        <li style={S.li}><strong>Profile content</strong> — your headline, bio, profile photo, and drink preferences.</li>
        <li style={S.li}><strong>Content you create</strong> — posts, photos, comments, ratings, collections, and messages.</li>
        <li style={S.li}><strong>Social graph</strong> — who you connect with, and which posts you cheer or comment on.</li>
        <li style={S.li}><strong>Technical data</strong> — IP address (used for rate limiting and abuse prevention), device type, and your timezone offset so notifications respect your quiet hours.</li>
        <li style={S.li}><strong>Push tokens</strong> — only if you turn on push notifications.</li>
      </ul>

      <h2 style={S.h2}>How we measure the product</h2>
      <p style={S.p}>
        We record which features are used so we can tell what's working — events like
        "opened the app", "shared a pour", "completed sign-up", along with your country and
        platform. This is <strong>first-party only</strong>: we run it ourselves, there is no
        third-party analytics SDK in DrinkedInn, and none of it is shared with anyone.
      </p>
      <p style={S.p}>
        These records deliberately exclude the content of what you write. Post text, comments,
        messages, search terms and your IP address are never stored in our analytics. Each event
        may only carry a short, fixed set of values — for example whether a post had a photo,
        not what the post said.
      </p>

      <h2 style={S.h2}>What we don't collect</h2>
      <p style={S.p}>
        We do not collect precise location data, contacts, health data, or advertising identifiers.
        We never see your password — it is hashed with bcrypt before storage and cannot be reversed.
      </p>

      <h2 style={S.h2}>How we use it</h2>
      <ul style={S.ul}>
        <li style={S.li}>To operate your account and show you a relevant feed.</li>
        <li style={S.li}>To send notifications you've opted into — capped daily and never between 10pm and 8am your local time.</li>
        <li style={S.li}>To verify your email and keep the platform free of bots.</li>
        <li style={S.li}>To detect abuse, spam, and attempts to break into accounts.</li>
        <li style={S.li}>To meet legal obligations, including age verification.</li>
      </ul>

      <h2 style={S.h2}>Who we share it with</h2>
      <p style={S.p}>
        We do not sell your personal data. We share it only with the service providers needed to run
        the platform: our database host, our application hosting and CDN provider, and our
        transactional email provider. Each processes data on our instructions only. We may also
        disclose data where required by law.
      </p>

      <h2 style={S.h2}>How long we keep it</h2>
      <p style={S.p}>
        We keep your data while your account is active. When you delete your account, your profile,
        posts, comments, photos, messages, and connections are permanently erased. Some minimal
        records may persist briefly in encrypted backups before rotating out.
      </p>

      <h2 style={S.h2}>Your rights</h2>
      <ul style={S.ul}>
        <li style={S.li}><strong>Delete</strong> — Account → Privacy &amp; data → Delete my account. This is immediate and irreversible.</li>
        <li style={S.li}><strong>Access and export</strong> — request a copy of your data from the same screen, or email us.</li>
        <li style={S.li}><strong>Correct</strong> — edit your profile at any time.</li>
        <li style={S.li}><strong>Object and restrict</strong> — turn off any notification category in settings.</li>
      </ul>
      <p style={S.p}>
        Depending on where you live, you may have additional rights under the GDPR, UK GDPR, or CCPA.
        Email <a href={`mailto:${PRIVACY_CONTACT}`} style={S.a}>{PRIVACY_CONTACT}</a> and we'll respond within 30 days.
      </p>

      <h2 style={S.h2}>Security</h2>
      <p style={S.p}>
        All traffic is encrypted in transit over HTTPS. Session tokens on mobile are stored in the
        device keychain rather than plain storage, and can be revoked from every device at once from
        the Security screen. Passwords are hashed with bcrypt. Access to production data is limited
        to those who need it.
      </p>

      <h2 style={S.h2}>Age restriction</h2>
      <p style={S.p}>
        DrinkedInn is strictly for people of legal drinking age, and never under 18. We verify date
        of birth at sign-up. If we learn that someone underage has created an account, we delete it.
      </p>

      <h2 style={S.h2}>Changes</h2>
      <p style={S.p}>
        If we make a material change to this policy we'll notify you in the app or by email before it
        takes effect.
      </p>
    </Shell>
  );
}

export function Terms() {
  return (
    <Shell kind="terms" eyebrow="Legal" title="Terms of Service">
      <p style={S.p}>
        These terms govern your use of DrinkedInn. By creating an account you agree to them. If you
        don't, please don't use the service.
      </p>

      <h2 style={S.h2}>Eligibility</h2>
      <p style={S.p}>
        You must be at least 18 years old and of legal drinking age where you live. You must provide
        accurate registration details, and you're responsible for keeping your password secure and
        for everything that happens under your account.
      </p>

      <h2 style={S.h2}>What you can post</h2>
      <p style={S.p}>You keep ownership of everything you post. By posting, you grant us a non-exclusive licence to host, display, and distribute that content on the platform so the service can function. That licence ends when you delete the content or your account.</p>
      <p style={S.p}>You agree not to post content that:</p>
      <ul style={S.ul}>
        <li style={S.li}>Encourages dangerous, excessive, or underage drinking.</li>
        <li style={S.li}>Harasses, threatens, impersonates, or defames anyone.</li>
        <li style={S.li}>Is unlawful, hateful, or sexually explicit.</li>
        <li style={S.li}>Infringes someone else's copyright or trademark.</li>
        <li style={S.li}>Is spam, a scam, or an unauthorised commercial promotion.</li>
      </ul>

      <h2 style={S.h2}>Acceptable use</h2>
      <p style={S.p}>
        Don't attempt to break, overload, scrape, or reverse-engineer the service, access another
        person's account, or bypass rate limits and security controls.
      </p>

      <h2 style={S.h2}>Moderation and termination</h2>
      <p style={S.p}>
        We may remove content or suspend accounts that break these terms. You can delete your account
        at any time from Account → Privacy &amp; data. We'll give notice before terminating an account
        unless doing so would risk harm to others or breach the law.
      </p>

      <h2 style={S.h2}>The service is provided as-is</h2>
      <p style={S.p}>
        DrinkedInn is provided without warranties of any kind. We don't guarantee uninterrupted
        availability, and we're not liable for indirect or consequential losses arising from your use
        of the service, to the extent permitted by law.
      </p>

      <h2 style={S.h2}>Drink responsibly</h2>
      <p style={S.p}>
        Nothing on DrinkedInn is medical advice. You are responsible for your own consumption and for
        never drinking and driving. See our{' '}
        <a href="/guidelines" style={S.a}>community guidelines</a> for how we approach this.
      </p>

      <h2 style={S.h2}>Changes to these terms</h2>
      <p style={S.p}>
        We may update these terms. If a change is material we'll tell you before it takes effect.
        Continuing to use DrinkedInn after that means you accept the updated terms.
      </p>

      <h2 style={S.h2}>Contact</h2>
      <p style={S.p}>
        Questions about these terms: <a href={`mailto:${CONTACT}`} style={S.a}>{CONTACT}</a>.
      </p>
    </Shell>
  );
}

export function Guidelines() {
  return (
    <Shell kind="guidelines" eyebrow="Community" title="Community Guidelines">
      <div style={S.callout}>
        <p style={S.calloutT}>DrinkedInn is about enjoying good drinks — never about drinking more.</p>
        <p style={S.calloutP}>
          These aren't just words in a policy. Streaks reward taking part in the community, not
          consumption. Notifications are capped and silenced overnight. The product is built so it
          can't nudge you toward drinking more.
        </p>
      </div>

      <h2 style={S.h2}>Be a decent person at the bar</h2>
      <ul style={S.ul}>
        <li style={S.li}>Disagree about a bottle, not about a person.</li>
        <li style={S.li}>No harassment, hate speech, or pile-ons.</li>
        <li style={S.li}>Don't impersonate anyone or misrepresent who you are.</li>
        <li style={S.li}>Don't share someone else's private information.</li>
      </ul>

      <h2 style={S.h2}>Drink content we don't allow</h2>
      <ul style={S.ul}>
        <li style={S.li}>Drinking games, shot challenges, or anything glorifying getting drunk fast.</li>
        <li style={S.li}>Content involving anyone underage with alcohol.</li>
        <li style={S.li}>Drinking and driving, or operating anything that needs a clear head.</li>
        <li style={S.li}>Mixing alcohol with drugs, or advice that puts people at risk.</li>
      </ul>

      <h2 style={S.h2}>Everyone's welcome, glass or not</h2>
      <p style={S.p}>
        Mocktails, alcohol-free spirits, coffee, and kombucha all belong here. Nobody has to justify
        what's in their glass, and pressuring someone about it is against these guidelines.
      </p>

      <h2 style={S.h2}>If drinking stops being fun</h2>
      <p style={S.p}>
        If you're worried about your drinking or someone else's, talk to a professional. Free,
        confidential support is available from{' '}
        <a href="https://www.drinkaware.co.uk/" target="_blank" rel="noopener noreferrer" style={S.a}>Drinkaware</a>{' '}
        in the UK, and from equivalent services in most countries. There's no judgement here.
      </p>

      <h2 style={S.h2}>Reporting</h2>
      <p style={S.p}>
        Use the options menu on any post to report it. We review reports and may remove content or
        suspend accounts. Serious safety concerns can go straight to{' '}
        <a href={`mailto:${CONTACT}`} style={S.a}>{CONTACT}</a>.
      </p>
    </Shell>
  );
}
