# 운중고 로고(雲中) 원본 생성기 — 구름 모양 '口' + 가운데를 관통하는 세로획 = 中
# python3 brand/make.py → brand/*.svg (앱 아이콘 PNG는 scripts/brand-icons.cjs가 이 SVG로 만든다)
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
CLOUD = '<circle cx="178" cy="284" r="56"/><circle cx="256" cy="236" r="82"/><circle cx="334" cy="284" r="56"/><rect x="122" y="262" width="268" height="78" rx="39"/>'
NAVY, AMBER, WHITE = '#0E2748', '#F5A524', '#FFFFFF'

def B(fg):
    # 꽉 찬 구름을 세로로 가르고(마스크로 진짜 구멍), 위아래로 노란 획
    return (f'<mask id="split"><rect width="512" height="512" fill="#fff"/>'
            f'<line x1="256" y1="140" x2="256" y2="380" stroke="#000" stroke-width="30" stroke-linecap="round"/></mask>'
            f'<g fill="{fg}" mask="url(#split)">{CLOUD}</g>'
            f'<line x1="256" y1="110" x2="256" y2="150" stroke="{AMBER}" stroke-width="30" stroke-linecap="round"/>'
            f'<line x1="256" y1="372" x2="256" y2="412" stroke="{AMBER}" stroke-width="30" stroke-linecap="round"/>')

def A(ink):
    # 구름 테두리(합집합 외곽선, 마스크로 안쪽을 비움) + 노란 세로획
    return (f'<mask id="ring"><g fill="none" stroke="#fff" stroke-width="52" stroke-linejoin="round">{CLOUD}</g>'
            f'<g fill="#000">{CLOUD}</g></mask>'
            f'<rect width="512" height="512" fill="{ink}" mask="url(#ring)"/>'
            f'<line x1="256" y1="118" x2="256" y2="410" stroke="{AMBER}" stroke-width="30" stroke-linecap="round"/>')

def svg(body, bg=None, rx=0, scale=1.0):
    back = f'<rect width="512" height="512" rx="{rx}" fill="{bg}"/>' if bg else ''
    t = f'translate(256 261) scale({scale}) translate(-256 -261)'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{back}<g transform="{t}">{body}</g></svg>\n'

FILES = {
    # 홈 화면 앱 아이콘 = B
    'icon-B-rounded.svg': svg(B(WHITE), NAVY, rx=115),
    'icon-B-square.svg': svg(B(WHITE), NAVY),
    'icon-B-maskable.svg': svg(B(WHITE), NAVY, scale=0.82),
    'icon-B-adaptive-fg.svg': svg(B(WHITE), None, scale=0.62),
    'icon-B-mono.svg': svg(B(WHITE), None, scale=0.62),
    'splash-B.svg': svg(B(WHITE)),
    # 머리글·포스터 = A(남색 바탕) / C(밝은 바탕)
    'logo-A-navy.svg': svg(A(WHITE), NAVY, rx=115),
    'logo-C-light.svg': svg(A(NAVY), WHITE, rx=115),
    'mark-A-white.svg': svg(A(WHITE)),  # 투명 배경, 어두운 곳에 얹기
    'mark-C-navy.svg': svg(A(NAVY)),    # 투명 배경, 밝은 곳에 얹기
}
for name, content in FILES.items():
    open(name, 'w').write(content)
print('\n'.join(FILES))
