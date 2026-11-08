# Builds both apps from one source:
#   dist/prime-forge.html  GM app (APP_MODE 'gm')    -> site index.html
#   dist/play.html         Player app (APP_MODE 'play') -> site play/index.html
import pathlib, base64
here = pathlib.Path(__file__).resolve().parent
root = here / 'src'
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'styles.css').read_text(encoding='utf-8')
js = '\n'.join(p.read_text(encoding='utf-8') for p in sorted((root / 'js').glob('*.js')))
fdir = here / 'fonts'
def face(fam, f, style):
    data = base64.b64encode((fdir / f).read_bytes()).decode()
    return "@font-face{font-family:'%s';font-style:%s;font-weight:300 800;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2');}" % (fam, style, data)
fonts = '/* Josefin Sans and Source Serif 4: SIL Open Font License 1.1 */\n' + '\n'.join([face('Josefin Sans','josefin-sans-latin-wght-normal.woff2','normal'), face('Source Serif 4','source-serif-4-latin-wght-normal.woff2','normal'), face('Source Serif 4','source-serif-4-latin-wght-italic.woff2','italic')])
base = html.replace('/*__FONTS__*/', fonts).replace('/*__CSS__*/', css)
APPS = {
    'gm':   ('prime-forge.html', 'Prime Forge', 'Prime Forge: design a Cortex Prime character file for any setting, then build and play its characters.'),
    'play': ('play.html', 'Prime Forge Players', 'Prime Forge Players: sign in, join your Cortex Prime campaigns with a room code, and play your characters on any device.'),
}
site = here.parent
publish = (site / 'firebase-config.js').exists() and (site / 'vendor').is_dir()
for mode, (fname, title, desc) in APPS.items():
    page = base.replace('<title>Prime Forge</title>', f'<title>{title}</title>')
    page = page.replace('content="Prime Forge: design a Cortex Prime character file for any setting, then build and play its characters."', f'content="{desc}"')
    page = page.replace('/*__JS__*/', f"const APP_MODE = '{mode}';\n" + js)
    dst = here / 'dist' / fname
    dst.parent.mkdir(exist_ok=True)
    dst.write_text(page, encoding='utf-8')
    print(dst, len(page), 'bytes')
    if publish:
        out = site / ('index.html' if mode == 'gm' else 'play/index.html')
        out.parent.mkdir(exist_ok=True)
        out.write_text(page, encoding='utf-8')
        print(out, 'updated')
