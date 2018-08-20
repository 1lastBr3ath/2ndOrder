'use strict';

// ================== TLDEXTRACT ================== //

const TLDEXTRACT = {};
const SCHEME_RE = new RegExp('^([a-z0-9+.-]+:)?//', 'i');
const SUFFIXURL = 'https://publicsuffix.org/list/public_suffix_list.dat';

const _extract = (tlds, netloc) => {
    let ret;
    const spl = netloc.split('.');

    spl.some((el, i) => {
        const maybe_tld = spl.slice(i).join('.');
        const star_tld = '*.' + spl.slice(i + 1).join('.');
        const exception_tld = '!' + maybe_tld;

        if (tlds.indexOf(exception_tld) !== -1) {
            ret = {
                registered_domain: spl.slice(0, i + 1).join('.'),
                tld: spl.slice(i + 1).join('.')
            };
            return true;
        }

        if (tlds.indexOf(star_tld) !== -1 || tlds.indexOf(maybe_tld) !== -1) {
            ret = {
                registered_domain: spl.slice(0, i).join('.'),
                tld: maybe_tld
            };
            return true;
        }
    });

    return ret || {
        registered_domain: netloc,
        tld: ''
    };
}


TLDEXTRACT.extract = async (url, callback) => {
    let subdomain, domain, tld, registered_domain;
    let netloc = url.replace(SCHEME_RE, '').split('/')[0];

    netloc = netloc.split('@').slice(-1)[0].split(':')[0];

    const obj = _extract(tlds, netloc);
    tld = obj.tld;
    registered_domain = obj.registered_domain;

    if (!tld && netloc && +netloc[0] === +netloc[0]) {
        if (require('net').isIP(netloc)) {
            return callback(null, {
                subdomain: '',
                domain: netloc,
                tld: ''
            });
        } else {
            return callback(Error('No domain/IP detected'));
        }
    }

    domain = registered_domain.split('.').slice(-1)[0];
    subdomain = registered_domain.split('.').slice(0, -1).join('.');

    callback(null, {
        subdomain: subdomain,
        domain: domain,
        tld: tld
    });
}

// ================== TLDEXTRACT ================== //

const gettlds = async url => {
    const response = await fetch(url);
    const text = await response.text();
    tlds = text.split('\n');
};

const getip = async domain => {
    const response = await fetch(`http://ip-api.com/json/${domain}?lang=en`);
    const text = await response.text();
    const json = JSON.parse(text);
    return 'fail' == json.status ? 'registrable' : json.query;
};

let tlds;
gettlds(SUFFIXURL);

const count = setInterval(() => {
    tlds ? clearInterval(count) : gettlds(SUFFIXURL);
}, 5000);

chrome.webRequest.onErrorOccurred.addListener(async details => {
        const url = details.url;
        // Ignore chrome's initial request for search keywords
        if(!/ERR_NAME_NOT_RESOLVED/.test(details.error) || /\s/ui.test(url) || -1 == url.indexOf('.')) return;
        
        let root;
        const domain = new URL(url).hostname;
        TLDEXTRACT.extract(url, (err, obj) => {
            if(!err){
                root = obj.domain + '.' + obj.tld;
            }
        });
        chrome.notifications.create({
                type: "basic",
                priority: 2,
                //requireInteraction: true,
                title: "DNS resolution failure",
                message: `Domain: ${domain}`,
                iconUrl: 'http://cm2.pw/favicon.ico'
        });
        if(prompt(details.error, url)){
            window.open('about:blank').document.write(`
                    <strong>URL:</strong> ${url}<br/>
                    <strong>Domain:</strong> ${domain}<br/>
                    <strong>Root domain:</strong> ${root} (${await getip(root)})<br/>
                    <strong>Origin:</strong> ${details.initiator}<br/>
            `);
        }
    },
    { urls: ["<all_urls>"] }
);

chrome.notifications.onClicked.addListener(id => {
    chrome.notifications.clear(id);
});
