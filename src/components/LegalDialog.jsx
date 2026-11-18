import { useEffect, useRef, useState } from 'react';
import { LEGAL_CONTACT, LEGAL_DOCUMENTS } from './legalDocuments.js';
import '../css/legalDialog.css';

function pageFromHash() {
    const key = window.location.hash.slice(1);
    return Object.hasOwn(LEGAL_DOCUMENTS, key) ? key : null;
}

export default function LegalDialog() {
    const [page, setPage] = useState(null);
    const dialogRef = useRef(null);
    const headingRef = useRef(null);
    const contentRef = useRef(null);

    useEffect(() => {
        const readLocation = () => setPage(pageFromHash());
        window.addEventListener('hashchange', readLocation);
        readLocation();
        return () => window.removeEventListener('hashchange', readLocation);
    }, []);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (page) {
            if (!dialog.open) dialog.showModal();
            contentRef.current.scrollTop = 0;
            headingRef.current.focus({ preventScroll: true });
        } else if (dialog.open) {
            dialog.close();
        }
    }, [page]);

    // Safari without closedby still gets outside-click dismissal. Starting a text
    // selection inside the dialog and releasing outside must not dismiss it.
    useEffect(() => {
        const dialog = dialogRef.current;
        if ('closedBy' in HTMLDialogElement.prototype) return;
        let pressedOutside = false;
        const outside = event => {
            const box = dialog.getBoundingClientRect();
            return event.clientX < box.left || event.clientX > box.right ||
                event.clientY < box.top || event.clientY > box.bottom;
        };
        const down = event => { pressedOutside = outside(event); };
        const up = event => { if (pressedOutside && outside(event)) dialog.close(); };
        dialog.addEventListener('pointerdown', down);
        dialog.addEventListener('pointerup', up);
        return () => {
            dialog.removeEventListener('pointerdown', down);
            dialog.removeEventListener('pointerup', up);
        };
    }, []);

    function closed() {
        setPage(null);
        if (pageFromHash()) {
            window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
        }
    }

    const document = LEGAL_DOCUMENTS[page || 'impressum'];
    return <dialog ref={dialogRef} className="legal-dialog" lang="de"
        aria-labelledby="legal-title" closedby="any" onClose={closed}>
        <header className="legal-dialog-header">
            <h2 id="legal-title" tabIndex={-1} ref={headingRef}>{document.title}</h2>
            <form method="dialog">
                <button className="legal-close" aria-label="Rechtliche Hinweise schließen" title="Schließen">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <path d="M6 6l12 12M6 18L18 6" />
                    </svg>
                </button>
            </form>
        </header>
        <nav className="legal-document-nav" aria-label="Rechtliche Dokumente">
            {Object.entries(LEGAL_DOCUMENTS).map(([key, entry]) => <a key={key} href={'#' + key}
                aria-current={page === key ? 'page' : undefined}>{entry.label}</a>)}
        </nav>
        <div className="legal-dialog-content" ref={contentRef}>
            <p>{document.intro}</p>
            <section>
                <h3>{document.contactTitle}</h3>
                <address>{LEGAL_CONTACT.name}<br />
                    <a href={'mailto:' + LEGAL_CONTACT.email}>{LEGAL_CONTACT.email}</a>
                </address>
            </section>
            {document.sections.map(section => <section key={section.title}>
                <h3>{section.title}</h3>
                {section.paragraphs.map(text => <p key={text}>{text}</p>)}
                {section.links && <ul className="legal-source-links">
                    {section.links.map(link => <li key={link.href}>
                        <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
                    </li>)}
                </ul>}
            </section>)}
        </div>
        <footer className="legal-dialog-footer">Stand: <time dateTime="2026-11-18">18. November 2026</time></footer>
    </dialog>;
}
