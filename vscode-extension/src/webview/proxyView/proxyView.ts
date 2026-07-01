import '../full-page-iframe.css';

window.addEventListener('DOMContentLoaded', () => {
    const zenn = document.querySelector('iframe#zenn');
    if (zenn && zenn instanceof HTMLIFrameElement) {
        activate(zenn);
    } else {
        console.error('iframe not available');
    }
});

function activate(zenn: HTMLIFrameElement) {
    const zennWindow = zenn.contentWindow;
    if (zennWindow) {
        watchZennWindow(zennWindow);
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'change_path': {
                    const newPath = '/' + message.relativePath;
                    if (zennWindow.location.pathname !== newPath) {
                        zennWindow.location.replace(newPath);
                    }
                    break;
                }
                default:
                    console.warn('unhandled message', message);
            }
        });
    }
}

function watchZennWindow(zennWindow: Window) {
    zennWindow.addEventListener('unload', () => setTimeout(() => {
        const observer = new MutationObserver(() => {
            if (zennWindow.document.head && zennWindow.document.body) {
                watchZennWindow(zennWindow);
                onLoadZennWindow(zennWindow);
                onChangeZennWindow(zennWindow);
                observer.disconnect();
            }
        });
        observer.observe(zennWindow.document, { childList: true, subtree: true });
    }, 0));
    zennWindow.addEventListener('load', () => {
        new MutationObserver(() => {
            onChangeZennWindow(zennWindow);
        }).observe(zennWindow.document, { childList: true, subtree: true });
    });
}

/**
 * 子 iframe の読み込みが完了して描画される直前に呼ばれる。ページ遷移時にも呼ばれる（重複呼び出しあり）。
 */
function onLoadZennWindow(zennWindow: Window) {
    const style = document.createElement('style');
    style.textContent = `
        /* for zenn-cli <= 0.1.85 */
        .main-sidebar { display: none }
        /* for zenn-cli >= 0.1.86 */
        .layout__sidebar { display: none }
        .chapter-header__book { display: none }
    `;
    zennWindow.document.head.appendChild(style);
}

/**
 * 子 iframe が変化したときに呼ばれる。ページ遷移時にも呼ばれる（重複呼び出しあり）。
 */
function onChangeZennWindow(zennWindow: Window) {
    const listenerAddedMarkDataName = '__zenn_editor_local_handle_a_click_event';
    zennWindow.document.querySelectorAll('a').forEach(e => {
        const url = new window.URL(e.href);
        if (url.origin !== '' && url.origin !== zennWindow.location.origin && !e.dataset[listenerAddedMarkDataName]) {
            e.addEventListener('click', event => {
                event.preventDefault();
                window.parent.postMessage({ source: 'proxy', command: 'open-link', link: e.href }, '*');
            });
            e.dataset[listenerAddedMarkDataName] = 'true';
        }
    });
    zennWindow.document.querySelectorAll<HTMLIFrameElement>('.zenn-embedded-card > iframe').forEach(e => {
        const contentUrl = e.dataset.content;
        if (contentUrl && !e.dataset[listenerAddedMarkDataName]) {
            const linkUrl = decodeURIComponent(contentUrl);
            let iframeMouseOver = false;
            zennWindow.addEventListener('blur', () => {
                if (iframeMouseOver) {
                    iframeMouseOver = false;
                    window.parent.postMessage({ source: 'proxy', command: 'open-link', link: linkUrl }, '*');
                }
            });
            e.addEventListener('mouseover', () => {
                zennWindow.focus();
                iframeMouseOver = true;
            });
            e.addEventListener('mouseout', () => {
                iframeMouseOver = false;
            });
            e.dataset[listenerAddedMarkDataName] = 'true';
        }
    });
}
