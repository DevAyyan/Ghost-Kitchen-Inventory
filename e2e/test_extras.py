"""Ledger badges and share picture, review's rows-to-check filter, and the shopping list's 'use yours first'."""
from conftest import BASE, open_app


def test_ledger_shows_badges_and_shares_the_week_as_a_picture(phone):
    open_app(phone)
    phone.goto(BASE + '/ledger', wait_until='networkidle')
    phone.wait_for_timeout(1000)  # count-ups finish
    assert phone.get_by_text('Badges ·', exact=False).count() == 1
    assert phone.get_by_text('Climate cost', exact=False).count() == 1
    share = phone.get_by_text('Share my week', exact=True)
    if share.count():
        share.first.click()
        with phone.expect_download(timeout=15_000) as dl:
            phone.get_by_text('Share picture', exact=True).click()
        assert dl.value.suggested_filename.endswith('.png')


def test_review_can_show_only_the_rows_to_check(phone):
    open_app(phone)
    phone.goto(BASE + '/scan', wait_until='networkidle')
    phone.get_by_text('Use the sample receipt', exact=True).click()
    phone.get_by_text('Green Grocer Market', exact=False).wait_for(timeout=15_000)
    assert phone.get_by_label('Item name').count() == 10
    phone.get_by_text('to check', exact=False).first.click()
    shown = phone.get_by_label('Item name').count()
    assert 0 < shown < 10
    phone.get_by_text('Show all rows', exact=True).click()
    assert phone.get_by_label('Item name').count() == 10


def test_shopping_list_says_to_use_turning_stock_first(phone):
    open_app(phone)  # the sample fridge has spinach with a day left
    phone.goto(BASE + '/plan', wait_until='networkidle')
    phone.get_by_label('Item to buy').fill('Spinach')
    phone.get_by_label('Add to shopping list').click()
    phone.get_by_text('Use yours first: Spinach', exact=False).first.wait_for(timeout=5000)
