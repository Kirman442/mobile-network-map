export const LEGAL_CONTACT = { name: 'Kirill Lisochenko', email: 'k.lisochenko@web.de' };

const links = {
    netlify: { href: 'https://www.netlify.com/pdf/netlify-dpa.pdf', label: 'Netlify · Data Processing Agreement' },
    netlifyPrivacy: { href: 'https://www.netlify.com/privacy/', label: 'Netlify · Privacy Statement' },
    carto: { href: 'https://www.carto.com/legal/basemap-terms/', label: 'CARTO · Basemaps Terms, Abschnitt 10' },
    cartoDpa: { href: 'https://carto.com/legal/pdpa', label: 'CARTO · Personal Data Processing Agreement' },
    authority: { href: 'https://www.lda.bayern.de/', label: 'Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)' },
};

export const LEGAL_DOCUMENTS = {
    impressum: {
        label: 'Impressum',
        title: 'Impressum',
        contactTitle: 'Anbieter und Kontakt',
        intro: 'MobileNetwork ist ein GIS- und Visualisierungsprojekt zur Darstellung öffentlich verfügbarer, aggregierter Mobilfunk-Leistungsdaten.',
        sections: [
            {
                title: 'Verantwortlich für die Inhalte',
                paragraphs: ['Kirill Lisochenko ist Anbieter dieser Anwendung und verantwortlich für ihre eigenen Inhalte. Für Fragen zum Projekt nutzen Sie bitte die oben genannte E-Mail-Adresse.'],
            },
            {
                title: 'Daten und Kartenquellen',
                paragraphs: ['Die dargestellten Leistungsdaten stammen aus Ookla Open Data. Der Kartenhintergrund wird von CARTO auf Grundlage von OpenStreetMap-Daten bereitgestellt. Die Quellenangaben der Karte bleiben direkt am Kartenrand sichtbar.'],
                links: [
                    { href: 'https://github.com/teamookla/ookla-open-data', label: 'Ookla Open Data' },
                    { href: 'https://carto.com/attribution/index.html', label: 'CARTO · Attribution' },
                    { href: 'https://www.openstreetmap.org/copyright', label: 'OpenStreetMap · Urheberrecht und Lizenz' },
                ],
            },
        ],
    },
    datenschutz: {
        label: 'Datenschutz',
        title: 'Datenschutzerklärung',
        contactTitle: 'Verantwortlicher und Kontakt',
        intro: 'Diese Datenschutzerklärung erläutert, welche personenbezogenen Daten beim Besuch von MobileNetwork verarbeitet werden. Die Anwendung bietet keine Benutzerkonten, Werbeanzeigen oder eingebundenen Analysedienste zur Verfolgung Ihres Nutzungsverhaltens.',
        sections: [
            {
                title: 'Bereitstellung und Sicherheit',
                paragraphs: [
                    'Die Website und ihre Datendateien werden über Netlify, Inc. (USA) und dessen Auslieferungsnetz bereitgestellt. Dabei werden technisch notwendige Verbindungsdaten verarbeitet, insbesondere IP-Adresse, Zeitpunkt, angeforderte Adresse, Browserinformationen und gegebenenfalls die verweisende Seite.',
                    'Zweck ist die zuverlässige Auslieferung und Absicherung der Website. Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. f DSGVO; das berechtigte Interesse besteht am sicheren Betrieb dieses öffentlich zugänglichen Informationsangebots. Netlify wird als Auftragsverarbeiter eingesetzt.',
                    'Verbindungs- und Sicherheitsdaten werden nur so lange verarbeitet, wie dies für Auslieferung, Fehleranalyse und Schutz vor Missbrauch erforderlich ist. Die Aufbewahrung bei Netlify richtet sich nach den eingesetzten Diensten und deren Protokollierungsfristen; bei einem konkreten Sicherheitsvorfall kann eine längere Aufbewahrung bis zur Klärung erforderlich sein.',
                ],
                links: [links.netlify, links.netlifyPrivacy],
            },
            {
                title: 'Kartenhintergrund von CARTO',
                paragraphs: [
                    'Beim Öffnen der Anwendung lädt Ihr Browser den Kartenhintergrund direkt von CARTO (CartoDB Inc., USA). Hierzu gehören Kartenstil, Kartenkacheln und, je nach gewähltem Stil, Symbole und Kartenschriften. CARTO erhält dabei Ihre IP-Adresse, technische Anfragedaten und die angeforderten Kartenausschnitte. Eine Standortfreigabe des Geräts wird nicht angefordert.',
                    'Die Einbindung dient der räumlichen Einordnung der Mobilfunkdaten. Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. f DSGVO: das Interesse, die ausdrücklich aufgerufene Karte funktionsfähig darzustellen.',
                    'Nach den veröffentlichten Basemap-Bedingungen kürzt CARTO IP-Adressen vor der Speicherung und bewahrt die gekürzten Anfrageprotokolle 30 Tage in den USA auf.',
                ],
                links: [links.carto, links.cartoDpa],
            },
            {
                title: 'Verarbeitung in Ihrem Browser',
                paragraphs: [
                    'Die Anwendung lädt vorbereitete, aggregierte Ookla-Daten und verarbeitet diese zur Darstellung der Punkte, Dichteansicht und Farbpaletten in Ihrem Browser. Sie führt selbst keine Geschwindigkeitstests durch und erhebt keine Mobilfunk-Messwerte Ihres Geräts.',
                    'Die Anwendung setzt keine eigenen Werbe- oder Tracking-Cookies und speichert Ihre Karten- und Palettenauswahl nicht im Local Storage oder Session Storage. Diese Einstellungen bestehen nur im Arbeitsspeicher der geöffneten Seite. Der Browser kann ausgelieferte Dateien und Kartenkacheln in seinem üblichen HTTP-Cache speichern.',
                ],
            },
            {
                title: 'Empfänger und Übermittlungen außerhalb der EU',
                paragraphs: ['Netlify und CARTO können für den technischen Betrieb Unterauftragsverarbeiter einsetzen und Daten außerhalb der EU bzw. des EWR verarbeiten. Ihre Auftragsverarbeitungsvereinbarungen sehen hierfür insbesondere EU-Standardvertragsklauseln vor; eine Übermittlung auf Grundlage des EU-U.S. Data Privacy Framework kommt nur bei entsprechend zertifizierten Empfängern in Betracht. Die verlinkten Vereinbarungen beschreiben die Garantien und die Möglichkeit, Informationen dazu anzufordern.'],
                links: [links.netlify, links.cartoDpa],
            },
            {
                title: 'Anfragen per E-Mail und externe Links',
                paragraphs: [
                    'Wenn Sie uns per E-Mail kontaktieren, werden Ihre E-Mail-Adresse und der Inhalt Ihrer Nachricht zur Bearbeitung der Anfrage verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. f DSGVO, bei der Erfüllung gesetzlicher Datenschutzpflichten Art. 6 Abs. 1 Buchst. c DSGVO. Nachrichten werden gelöscht, sobald die Bearbeitung abgeschlossen ist und keine gesetzlichen Aufbewahrungspflichten oder offenen Rechtsansprüche entgegenstehen.',
                    'Links zu Quellen, Dokumentationen und OpenStreetMap öffnen fremde Websites erst, wenn Sie den Link auswählen. Dort gelten die Datenschutzhinweise des jeweiligen Anbieters. Die Verbindung zum CARTO-Kartendienst entsteht dagegen bereits beim Laden der Karte.',
                ],
            },
            {
                title: 'Ihre Rechte',
                paragraphs: [
                    'Unter den gesetzlichen Voraussetzungen haben Sie das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit. Wenn eine Verarbeitung auf Ihrer Einwilligung beruht, können Sie diese jederzeit mit Wirkung für die Zukunft widerrufen.',
                    'Widerspruchsrecht: Gegen eine Verarbeitung auf Grundlage von Art. 6 Abs. 1 Buchst. f DSGVO können Sie aus Gründen, die sich aus Ihrer besonderen Situation ergeben, Widerspruch einlegen (Art. 21 DSGVO). Nutzen Sie dafür die oben genannte E-Mail-Adresse.',
                    'Sie können sich bei einer Datenschutzaufsichtsbehörde beschweren, insbesondere an Ihrem Aufenthaltsort, Arbeitsplatz oder am Ort des vermuteten Verstoßes. Für einen privaten Betreiber in Bayern ist das BayLDA zuständig. Die Anwendung trifft keine automatisierten Entscheidungen mit rechtlicher oder ähnlich erheblicher Wirkung und erstellt keine Nutzerprofile. Die Angabe personenbezogener Daten ist weder gesetzlich noch vertraglich vorgeschrieben; ohne die zur Übertragung nötigen Verbindungsdaten können Website und Karte jedoch nicht ausgeliefert werden.',
                ],
                links: [links.authority],
            },
        ],
    },
};
