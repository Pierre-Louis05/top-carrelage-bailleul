# Fabrique les photos du site a partir des originaux de photos/magasin-brut/.
#
# Pour chaque sujet on genere deux fichiers WebP :
#   - <nom>-large.webp : 2000 px de large, cadrage panoramique, pour les bannieres
#   - <nom>.webp       : 900 px de large, cadrage ~3/2, pour les cartes
#
# Les cadrages sont choisis a la main (coordonnees en pixels sur l'original
# 2000x1125) pour sortir ce qui ne doit pas se voir : faux plafonds, comptoirs
# encombres, panneaux fournisseurs, cartons de reserve.
#
# Usage : python3 photos/generer-photos-site.py

from PIL import Image, ImageEnhance, ImageStat
import os

SRC = '/Users/pierre-louisquentin/remotion/topcarrelage/photos/magasin-brut'
DST = '/Users/pierre-louisquentin/remotion/topcarrelage/photos/site'

def balance(im, force):
    """Balance des blancs partielle facon gray-world. force=0 -> aucune."""
    if force <= 0:
        return im
    r, g, b = ImageStat.Stat(im).mean
    moy = (r + g + b) / 3
    def cor(c, m):
        f = 1 + (moy / m - 1) * force
        return c.point(lambda v: max(0, min(255, int(v * f))))
    bandes = im.split()
    return Image.merge('RGB', (cor(bandes[0], r), cor(bandes[1], g), cor(bandes[2], b)))

def fabrique(source, sortie, boite, largeur, expo=1.0, contraste=1.0, sat=1.0, wb=0.0, q=84):
    im = Image.open(os.path.join(SRC, source)).convert('RGB').crop(boite)
    im = balance(im, wb)
    if expo != 1.0:    im = ImageEnhance.Brightness(im).enhance(expo)
    if contraste != 1.0: im = ImageEnhance.Contrast(im).enhance(contraste)
    if sat != 1.0:     im = ImageEnhance.Color(im).enhance(sat)
    if im.width > largeur:
        im = im.resize((largeur, round(im.height * largeur / im.width)), Image.LANCZOS)
    im = ImageEnhance.Sharpness(im).enhance(1.15)
    chemin = os.path.join(DST, sortie)
    im.save(chemin, 'WEBP', quality=q, method=6)
    print(f'{sortie:38s} {im.width}x{im.height}  ratio {im.width/im.height:.2f}  {os.path.getsize(chemin)//1024} Ko')

# nom : (source, crop banniere, crop carte, reglages)
SERIE = [
    # --- interieur magasin ---
    ('showroom-carrelage', '7.jpg',  (0, 300, 2000, 1050), (350, 200, 1750, 1125), dict(expo=1.06, contraste=1.04)),
    ('carreaux-decor',     '10.jpg', (170, 250, 2000, 1050), (250, 258, 1550, 1125), dict(expo=1.04, wb=0.4)),
    # --- salles de bain ---
    ('salle-de-bain-verte',     '13.jpg', (0, 180, 1760, 1080), (150, 120, 1650, 1125), dict(expo=1.03)),
    ('salle-de-bain-marbre',    '15.jpg', (0,  60, 2000,  930), (130,   0, 1700, 1050), dict()),
    ('salle-de-bain-travertin', '16.jpg', (0, 100, 2000,  970), (300,  80, 2000, 1125), dict(expo=1.05)),
    ('espace-sanitaire',        '14.jpg', (0, 120, 2000,  920), (120, 100, 1620, 1100), dict(expo=1.04)),
    # --- pierre naturelle (mur en biais : recadrage serre sur la pierre) ---
    # ATTENTION : la source 11-retouche.webp est la photo 11.jpg passee dans un
    # editeur d images IA. Le cable et les carreaux poses au sol ont ete effaces,
    # mais l appareillage et le grain de la pierre ont aussi ete redessines : la
    # matiere affichee n est pas exactement celle du mur d exposition.
    # Choix assume par le magasin le 2026-09-25 pour l aspect vitrine.
    # L originale non modifiee reste disponible en 11.jpg.
    ('mur-pierre-naturelle', '11-retouche.webp', (150, 90, 1672, 720), (700, 150, 1500, 690), dict()),
    # --- parquet : on coupe tout le faux plafond et le poele ---
    ('salle-parquet', '22.jpg', (110, 450, 2000, 1090), (300, 400, 1388, 1125), dict(expo=1.10, contraste=1.05, wb=0.55)),
    # --- outillage : on coupe le comptoir encombre et le panneau interdiction ---
    ('outillage-atelier', '20.jpg', (180, 150, 2000, 800), (180, 150, 1260, 790), dict(expo=1.12, contraste=1.05, wb=0.35)),
    # --- exterieurs ---
    ('facade-principale', '6.jpg',  (0, 160, 2000, 960), (100, 190, 1500, 1125), dict()),
    ('deux-batiments',    '18.jpg', (150, 280, 2000, 880), (150, 300, 1900, 860), dict(expo=1.04)),
]

for nom, src, bh, bc, opt in SERIE:
    fabrique(src, f'{nom}-large.webp', bh, 2000, **opt)
    fabrique(src, f'{nom}.webp',      bc, 900, q=80, **opt)

# banniere d'accueil : cadrage plus carre car le bloc est haut
fabrique('7.jpg', 'showroom-vue-large.webp', (250, 125, 1850, 1125), 1600, expo=1.06, contraste=1.04)
