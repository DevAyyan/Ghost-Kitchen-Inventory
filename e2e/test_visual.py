"""
Screenshot comparisons for the pixel art, under reduced motion so every frame holds still. A change to the
sprite scripts that alters the art fails here; if it was intended, rerun with UPDATE_BASELINES=1.
"""
import io
import os
from pathlib import Path

from PIL import Image, ImageChops
from conftest import open_app

BASELINES = Path(__file__).parent / 'baselines'
UPDATE = os.environ.get('UPDATE_BASELINES') == '1'
# Share of pixels allowed to differ (font hinting and anti-aliased text vary a little between machines).
TOLERANCE = 0.02


def check(name: str, png: bytes):
    BASELINES.mkdir(exist_ok=True)
    path = BASELINES / f'{name}.png'
    shot = Image.open(io.BytesIO(png)).convert('RGB')
    if UPDATE or not path.exists():
        shot.save(path)
        return
    base = Image.open(path).convert('RGB')
    assert base.size == shot.size, f'{name}: size {shot.size} vs baseline {base.size}'
    diff = ImageChops.difference(base, shot).convert('L').point(lambda v: 255 if v > 24 else 0)
    changed = (shot.width * shot.height - diff.histogram()[0]) / (shot.width * shot.height)
    if changed > TOLERANCE:
        shot.save(BASELINES / f'{name}.actual.png')
    assert changed <= TOLERANCE, f'{name}: {changed:.1%} of pixels differ (saved {name}.actual.png)'


def scene_box(page):
    door = page.get_by_test_id('door-fridge')
    door.scroll_into_view_if_needed()
    return door.locator('xpath=..').bounding_box()


def test_kitchen_scene(phone):
    open_app(phone)
    check('scene-390', phone.screenshot(clip=scene_box(phone)))


def test_kitchen_scene_desktop(desktop):
    open_app(desktop)
    check('scene-1280', desktop.screenshot(clip=scene_box(desktop)))


def test_open_compartments(phone):
    open_app(phone)
    for zone in ('fridge', 'freezer', 'pantry'):
        phone.get_by_test_id(f'door-{zone}').scroll_into_view_if_needed()
        phone.get_by_test_id(f'door-{zone}').click()
        phone.get_by_label(f'Close the {zone} door').wait_for()
        phone.mouse.move(0, 0)
        phone.wait_for_timeout(400)
        check(f'open-{zone}-390', phone.screenshot())
        phone.get_by_label(f'Close the {zone} door').click()
        phone.get_by_test_id(f'door-{zone}').wait_for()
