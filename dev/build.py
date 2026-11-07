import pathlib
root = pathlib.Path(__file__).parent / 'src'
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'styles.css').read_text(encoding='utf-8')
js = '\n'.join(p.read_text(encoding='utf-8') for p in sorted((root / 'js').glob('*.js')))
import base64
fdir = pathlib.Path(__file__).parent / 'fonts'
def face(fam, f, style):
    data = base64.b64encode((fdir / f).read_bytes()).decode()
    return "@font-face{font-family:'%s';font-style:%s;font-weight:300 800;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2');}" % (fam, style, data)
fonts = '/* Josefin Sans and Source Serif 4: SIL Open Font License 1.1 */\n' + '\n'.join([face('Josefin Sans','josefin-sans-latin-wght-normal.woff2','normal'), face('Source Serif 4','source-serif-4-latin-wght-normal.woff2','normal'), face('Source Serif 4','source-serif-4-latin-wght-italic.woff2','italic')])
html = html.replace('/*__FONTS__*/', fonts)
out = html.replace('/*__CSS__*/', css).replace('/*__JS__*/', js)
dst = pathlib.Path(__file__).parent / 'dist' / 'prime-forge.html'
dst.parent.mkdir(exist_ok=True)
dst.write_text(out, encoding='utf-8')
print(dst, len(out), 'bytes')
# When this project sits in the site repo's dev/ folder, also refresh the published page.
site = pathlib.Path(__file__).resolve().parent.parent
if (site / 'firebase-config.js').exists() and (site / 'vendor').is_dir():
    (site / 'index.html').write_text(out, encoding='utf-8')
    print(site / 'index.html', 'updated')
