import { COMPANY } from './data'
import { day, signature, type Letter } from './letters'

/**
 * A letter or mail as it goes out: shown in the work window with every
 * field the agent filled in highlighted, and printed plain for the post.
 */

export type Signed = { png: string; name: string }

/** `[[field]]` → a highlighted field, so you see exactly what the agent filled in. */
export function Filled({ text, plain }: { text: string; plain?: boolean }) {
  const parts = text.split(/\[\[(.+?)\]\]/g)
  return <>{parts.map((p, i) => (i % 2 && !plain ? <mark key={i}>{p}</mark> : p))}</>
}

/** A letter or mail exactly as it goes out after approval. */
export function LetterView({ letter, signed, count }: { letter: Letter; signed?: Signed; count?: number }) {
  return (
    <div className="letter">
      <div className="letter__meta">
        <span className="badge badge--info">{letter.channel}</span>
        <span>Vorlage: {letter.template}</span>
        {count && count > 1 && <span className="badge badge--muted">Serienbrief · {count} Empfänger</span>}
        <span className="letter__legend">
          <mark>markiert</mark> = vom Agenten eingesetzt
        </span>
      </div>
      <Paper letter={letter} signed={signed} />
      {letter.basis && <p className="ws-note">Rechtsgrundlage der Vorlage: {letter.basis}. Die Vorlagen werden bei der Einrichtung durch Ihre eigenen ersetzt und einmal juristisch geprüft.</p>}
    </div>
  )
}

/** The page itself — marked fields highlighted on screen, plain when printed. */
export function Paper({ letter, signed, plain }: { letter: Letter; signed?: Signed; plain?: boolean }) {
  const mail = letter.channel !== 'Brief'
  return (
    <article className={`paper${mail ? ' paper--mail' : ''}`}>
        {mail ? (
          <dl className="paper__mailhead">
            <div>
              <dt>Von</dt>
              <dd>{signature(letter)}</dd>
            </div>
            <div>
              <dt>An</dt>
              <dd>
                <Filled plain={plain} text={`[[${letter.to.join(', ')}]]`} />
              </dd>
            </div>
            <div>
              <dt>Betreff</dt>
              <dd>
                <b>
                  <Filled plain={plain} text={letter.subject} />
                </b>
              </dd>
            </div>
            {letter.attachments && (
              <div>
                <dt>Anhang</dt>
                <dd>{letter.attachments.map((a) => `📎 ${a}`).join('  ')}</dd>
              </div>
            )}
          </dl>
        ) : (
          <>
            <header className="paper__head">
              {COMPANY.logo ? <img src={COMPANY.logo} alt={COMPANY.name} /> : <b>{COMPANY.name}</b>}
            </header>
            <div className="paper__sender">{signature(letter)}</div>
            <address className="paper__to">
              {letter.to.map((l, i) => (
                <div key={i}>
                  <Filled plain={plain} text={`[[${l}]]`} />
                </div>
              ))}
            </address>
            <div className="paper__date">
              Musterstadt, <Filled plain={plain} text={`[[${day()}]]`} />
            </div>
            <p className="paper__subject">
              <Filled plain={plain} text={letter.subject} />
            </p>
          </>
        )}
        <p>
          <Filled plain={plain} text={letter.salutation} />
        </p>
        {letter.body.map((b, i) => (
          <p key={i}>
            <Filled plain={plain} text={b} />
          </p>
        ))}
        <p>
          Mit freundlichen Grüßen
          <br />
          {signed && (
            <>
              <img className="paper__sig" src={signed.png} alt={`Unterschrift ${signed.name}`} />
              <br />
              {signed.name}, Geschäftsführung
              <br />
            </>
          )}
          {COMPANY.name}
          <br />
          <span className="paper__dept">{letter.from}</span>
        </p>
        {!mail && letter.attachments && <p className="paper__attach">Anlagen: {letter.attachments.join(', ')}</p>}
    </article>
  )
}

