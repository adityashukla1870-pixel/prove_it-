function LineIcon({ children, size = 24 }) {
  return <svg className="domain-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

export function ChallengeIcon({ size }) {
  return <LineIcon size={size}><path d="M5 4.8h14v14.4H5z" /><path d="M8.5 9h7M8.5 12h7M8.5 15h4" /></LineIcon>;
}

export function BadgeIcon({ size }) {
  return <LineIcon size={size}><path d="m12 3 2.1 1.2 2.4-.1 1.2 2.1 2.1 1.2-.1 2.4L21 12l-1.3 2.2.1 2.4-2.1 1.2-1.2 2.1-2.4-.1L12 21l-2.2-1.2-2.4.1-1.2-2.1-2.1-1.2.1-2.4L3 12l1.2-2.2-.1-2.4 2.1-1.2 1.2-2.1 2.4.1L12 3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></LineIcon>;
}

export function SparkIcon({ size }) {
  return <LineIcon size={size}><path d="m12 2 1.45 6.55L20 10l-6.55 1.45L12 18l-1.45-6.55L4 10l6.55-1.45L12 2Z" /><path d="m19 16 .65 2.35L22 19l-2.35.65L19 22l-.65-2.35L16 19l2.35-.65L19 16Z" /></LineIcon>;
}

export function BriefcaseIcon({ size }) {
  return <LineIcon size={size}><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12h18M10 12v2h4v-2" /></LineIcon>;
}

export function MicIcon({ size }) {
  return <LineIcon size={size}><rect x="8.5" y="3" width="7" height="11" rx="3.5" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></LineIcon>;
}

export function ProofJourney() {
  return (
    <div className="proof-journey" role="img" aria-label="A challenge becomes defended work and verified proof">
      <div className="proof-journey__halo" />
      <div className="proof-journey__line" aria-hidden="true" />
      <div className="proof-journey__node proof-journey__node--challenge"><span><ChallengeIcon size={21} /></span><strong>Challenge</strong><small>real work</small></div>
      <div className="proof-journey__node proof-journey__node--defense"><span><SparkIcon size={21} /></span><strong>Defend</strong><small>your thinking</small></div>
      <div className="proof-journey__node proof-journey__node--proof"><span><BadgeIcon size={21} /></span><strong>Proof</strong><small>verified result</small></div>
    </div>
  );
}

export function CandidateProofVisual() {
  return (
    <div className="candidate-visual" role="img" aria-label="Illustration of candidate proof progress with a verified badge">
      <div className="candidate-visual__ring"><BadgeIcon size={30} /><strong>Verified</strong><small>proof profile</small></div>
      <div className="candidate-visual__details">
        <span className="visual-kicker">Proof profile</span>
        <strong>Evidence-led</strong>
        <div className="visual-bars"><i style={{ width: '88%' }} /><i style={{ width: '67%' }} /><i style={{ width: '76%' }} /></div>
        <div className="visual-legend"><span><b className="dot dot--teal" />Reasoning</span><span><b className="dot dot--gold" />Consistency</span></div>
      </div>
    </div>
  );
}

export function StartupTalentVisual() {
  return (
    <div className="startup-visual" role="img" aria-label="Illustration of a startup challenge turning candidate work into evidence">
      <div className="startup-visual__glow" />
      <div className="startup-visual__top"><span className="visual-kicker">Challenge signal</span><span className="live-dot"><i /> Live</span></div>
      <div className="startup-visual__title"><span className="startup-visual__icon"><BriefcaseIcon size={20} /></span><div><strong>Find the doers</strong><small>Practical work, visible evidence</small></div></div>
      <div className="startup-visual__metric"><span>Hiring signal</span><strong>Evidence map</strong></div>
      <div className="visual-bars visual-bars--large"><i style={{ width: '84%' }} /><i style={{ width: '72%' }} /><i style={{ width: '92%' }} /></div>
      <div className="startup-visual__avatars"><span>W</span><span>D</span><span>P</span><small>work · defence · proof</small></div>
    </div>
  );
}
