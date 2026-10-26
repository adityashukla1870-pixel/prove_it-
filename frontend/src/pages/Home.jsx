import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Login from './Login.jsx';
import { ProofJourney } from '../components/DomainVisuals.jsx';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const audiences = [
  ['Entrepreneurs', 'Test ideas and find co-founders who can actually deliver.'],
  ['Job seekers', 'Prove skill without pedigree and build a portable profile.'],
  ['Startups and recruiters', 'A pre-ranked, explainable shortlist instead of a pile of resumes.'],
  ['Mentors', 'Review only the top few and endorse the best.'],
];
const responsibleCopy = 'AI recommends, humans decide. Only the content of answers is scored, never face, accent or demographics. Candidates see their full breakdown and can request a human re-review.';
const responsibleWords = responsibleCopy.split(' ');

const examples = {
  job: {
    mode: 'Hiring',
    title: 'Junior Data Analyst',
    skill: 'Data analysis',
    task: 'Find a useful trend in weekly sales data. Check it, then explain what the founders should know.',
  },
  idea: {
    mode: 'Founder Mode',
    title: 'College tiffin delivery',
    skill: 'Product development',
    task: 'Map the first order flow for a hostel, then show how you would test demand with nearby cooks.',
  },
};

function ProofReceipt({ mode, onModeChange }) {
  const example = examples[mode];
  return (
    <div className="home__receipt">
      <div className="home__receipt-top">
        <span>Challenge preview</span>
        <span className="home__receipt-status">Draft</span>
      </div>
      <div className="home__mode-switch" role="group" aria-label="Choose a challenge type">
        {Object.entries(examples).map(([key, item]) => (
          <button key={key} type="button" aria-pressed={mode === key} onClick={() => onModeChange(key)}>
            {item.mode}
          </button>
        ))}
      </div>
      <div className="home__receipt-body">
        <span className="home__receipt-skill">{example.skill} · 30 minutes</span>
        <h2>{example.title}</h2>
        <p>{example.task}</p>
      </div>
      <div className="home__receipt-foot">
        <span>Task → spoken defence → evidence</span>
        <span aria-hidden="true">100</span>
      </div>
    </div>
  );
}

function StageInterface({ stage }) {
  if (stage === 'solve') return (
    <div className="home__mini-ui">
      <span className="home__ui-label">Candidate task</span>
      <strong>Junior Data Analyst</strong>
      <p>Review a weekly sales report. Find one trend and explain how you would validate it.</p>
      <div className="home__ui-meta"><span>30 min</span><span>Data analysis</span></div>
    </div>
  );
  if (stage === 'defend') return (
    <div className="home__mini-ui">
      <span className="home__ui-label">Question about your answer</span>
      <strong>What evidence supports that trend?</strong>
      <p className="home__ui-answer">"I'd compare the same pattern across another time window."</p>
      <div className="home__ui-meta"><span>Spoken answer</span><span>Editable transcript</span></div>
    </div>
  );
  if (stage === 'score') return (
    <div className="home__mini-ui">
      <span className="home__ui-label">Example rubric score</span>
      <div className="home__score-row"><strong>Data reasoning</strong><strong>26 / 30</strong></div>
      <p className="home__ui-answer">"Compare the same pattern across another time window."</p>
      <div className="home__ui-meta"><span>Criterion evidence</span><span>Human review available</span></div>
    </div>
  );
  return (
    <div className="home__mini-ui">
      <span className="home__ui-label">Badge format preview</span>
      <strong>Data analysis</strong>
      <div className="home__badge-number">86<span> / 100</span></div>
      <div className="home__ui-meta"><span>Signed result</span><span>Public verification</span></div>
    </div>
  );
}

export default function Home() {
  useEffect(() => {
    document.title = 'ProveIt - Prove it. Defend it.';
  }, []);
  const [mode, setMode] = useState('job');
  const [audienceIndex, setAudienceIndex] = useState(0);
  const homeRef = useRef(null);

  useLayoutEffect(() => {
    const root = homeRef.current;
    if (!root) return undefined;
    const media = gsap.matchMedia(root);
    media.add({
      reduce: '(prefers-reduced-motion: reduce)',
      desktop: '(min-width: 901px) and (prefers-reduced-motion: no-preference)',
      mobile: '(max-width: 900px) and (prefers-reduced-motion: no-preference)',
    }, (context) => {
      const { reduce, desktop } = context.conditions;
      if (reduce) return undefined;

      /* Scrubbing text reveals on the Responsible AI section */
      const words = gsap.utils.toArray('[data-scrub-word]', root);
      if (words.length) {
        gsap.fromTo(words, { opacity: 0.18 }, {
          opacity: 1,
          stagger: 0.06,
          ease: 'none',
          scrollTrigger: { trigger: '.home__responsible', start: 'top 72%', end: 'center 42%', scrub: true },
        });
      }

      /* Card stacking: process stage cards stack on scroll */
      const stageCards = gsap.utils.toArray('.home__stage', root);
      if (stageCards.length) {
        stageCards.forEach((card, i) => {
          gsap.fromTo(card,
            { opacity: 0.3, scale: 0.92, y: 60 },
            {
              opacity: 1, scale: 1, y: 0,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: card,
                start: 'top 85%',
                end: 'top 55%',
                scrub: true,
              },
            }
          );
        });
      }

      /* Image scale & fade on the receipt card */
      const receiptEl = root.querySelector('.home__receipt');
      if (receiptEl) {
        gsap.fromTo(receiptEl,
          { scale: 0.88, opacity: 0.4 },
          {
            scale: 1, opacity: 1,
            ease: 'power2.out',
            scrollTrigger: { trigger: '.home__hero', start: 'top 80%', end: 'top 20%', scrub: true },
          }
        );
      }

      /* Audience detail fade-in */
      const audienceDetail = root.querySelector('.home__audience-detail');
      if (audienceDetail) {
        gsap.fromTo(audienceDetail,
          { opacity: 0.2, y: 40 },
          {
            opacity: 1, y: 0,
            ease: 'power2.out',
            scrollTrigger: { trigger: '.home__audience', start: 'top 70%', end: 'top 30%', scrub: true },
          }
        );
      }

      if (desktop) {
        ScrollTrigger.create({
          trigger: '.home__process',
          start: 'top top+=88',
          end: 'bottom bottom',
          pin: '.home__process-aside',
          pinSpacing: false,
          invalidateOnRefresh: true,
        });
      }
      return undefined;
    });
    return () => media.revert();
  }, []);

  function moveAudience(direction) {
    setAudienceIndex((index) => (index + direction + audiences.length) % audiences.length);
  }

  return (
    <div className="home" ref={homeRef}>
      <section className="home__hero">
        <div className="home__hero-copy">
          <h1>
            <span>Show the work.</span>
            <span>Defend it.</span>
          </h1>
          <p>Turn practical challenges and spoken follow-ups into evidence of skill that teams can verify.</p>
          <div className="home__actions">
            <Link className="home__button" to="/register">Create your account</Link>
            <Link className="home__text-link" to="/login">Log in</Link>
          </div>
        </div>
        <div className="home__hero-image">
          <ProofReceipt mode={mode} onModeChange={setMode} />
        </div>
      </section>

      <section className="home__access" id="access">
        <div className="home__access-copy">
          <span className="home__eyebrow">Start with the right workspace</span>
          <h2>Proof that travels with you.</h2>
          <p>Choose a candidate workspace to discover opportunities, or a startup workspace to turn real work into a fair hiring signal.</p>
          <ProofJourney />
        </div>
        <div className="home__access-card"><Login /></div>
      </section>

      <div className="home__marquee" role="img" aria-label="Platform flow: task, defence, evidence, human review, verified badge">
        <div className="home__marquee-track" aria-hidden="true">
          {[0, 1].map((copy) => <div className="home__marquee-run" key={copy}>{['Task', 'Defend', 'Evidence', 'Human review', 'Verified badge'].map((label) => <span key={`${copy}-${label}`}>{label}<i /></span>)}</div>)}
        </div>
      </div>

      <section className="home__process" id="how-it-works" aria-label="How ProveIt works">
        <div className="home__process-aside">
          <span className="home__eyebrow">From real work to a verified result</span>
          <h2>From task<br />to badge.</h2>
          <p>See how a real piece of work becomes a result candidates can explain and teams can verify.</p>
        </div>
        <div className="home__process-grid">
          {[
          { id: 'solve', title: 'Solve', copy: "A timed, real-world micro-task from the startup's actual work." },
          { id: 'defend', title: 'Defend', copy: 'AI asks 2-3 questions about YOUR answer. You reply by voice.' },
          { id: 'score', title: 'Evidence', copy: 'A rubric ties every score to words from your answer.' },
          { id: 'badge', title: 'Get verified', copy: 'A signed badge anyone can check with a link or QR code.' },
          ].map((item, index) => (
            <article className={`home__stage home__stage--${index + 1}`} key={item.id}>
              <div className="home__stage-heading">
                <h3>{item.title}</h3>
                <span>{item.copy}</span>
              </div>
              <div className="home__stage-ui"><StageInterface stage={item.id} /></div>
            </article>
          ))}
        </div>
      </section>

      <section className="home__audience" id="audiences" aria-label="Who ProveIt serves">
        <div className="home__audience-heading">
          <span className="home__eyebrow">Built for real work</span>
          <h2>One proof format.<br />Different goals.</h2>
          <div className="home__carousel-controls">
            <button type="button" aria-label="Previous audience" onClick={() => moveAudience(-1)}>&larr;</button>
            <button type="button" aria-label="Next audience" onClick={() => moveAudience(1)}>&rarr;</button>
          </div>
        </div>
        <div className="home__audience-detail" aria-live="polite">
          <span className="home__eyebrow">For {audiences[audienceIndex][0]}</span>
          <p>{audiences[audienceIndex][1]}</p>
          <div className="home__audience-tabs" role="group" aria-label="Choose an audience">
            {audiences.map(([title], index) => <button type="button" aria-pressed={audienceIndex === index} key={title} onClick={() => setAudienceIndex(index)}>{title}</button>)}
          </div>
        </div>
      </section>

      <section className="home__responsible" id="responsible-ai">
        <div className="home__responsible-copy">
          <h2>Responsible AI</h2>
          <p aria-label={responsibleCopy}>{responsibleWords.map((word, index) => <span data-scrub-word aria-hidden="true" key={`${word}-${index}`}>{word}{index < responsibleWords.length - 1 ? ' ' : ''}</span>)}</p>
        </div>
        <div className="home__responsible-ui">
          <div className="home__review-ui">
            <span className="home__ui-label">Example evidence you can inspect</span>
            <strong>Reasoning and trade-offs</strong>
            <p>Evidence from the candidate's answer</p>
            <blockquote>"I would test the same pattern on another time window."</blockquote>
            <span className="home__review-status">Human re-review available</span>
          </div>
        </div>
      </section>

      <section className="home__close" id="proof-path">
        <div className="home__close-copy">
          <h2>Make proof<br />the starting point.</h2>
          <p>Build a clearer signal from real work, careful explanations, and evidence that people can verify.</p>
          <div className="home__actions">
            <Link className="home__button home__button--dark" to="/register">Create your account</Link>
            <Link className="home__text-link home__text-link--dark" to="/login">Log in</Link>
          </div>
        </div>
        <div className="home__close-ui">
          <div className="home__create-ui">
            <span className="home__ui-label">First, choose what you're building</span>
            <h3>Real work. Clear proof.</h3>
            <div className="home__create-choices" aria-label="Challenge type examples">
              <span>I'm hiring</span>
              <span>I have an idea</span>
            </div>
            <p>Both paths are grounded in practical tasks, thoughtful defence, and evidence-led results.</p>
            <Link className="home__button home__button--dark" to="/register">Choose your workspace</Link>
          </div>
        </div>
        <footer className="home__footer"><span>ProveIt</span><nav aria-label="Footer"><Link to="/login">Log in</Link><Link to="/register">Create account</Link></nav><span>Proof before pedigree.</span></footer>
      </section>
    </div>
  );
}
