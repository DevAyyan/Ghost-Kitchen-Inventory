"""
Tap and speak with the browser's speech recognizer faked: one that hears a sentence, one that never
answers (what Chromium and Brave do), one with the microphone blocked, and a browser with no speech API.
"""
import pytest

from conftest import open_app

HEARS = """
window.webkitSpeechRecognition = class extends EventTarget {
  start() {
    setTimeout(() => this.dispatchEvent(new Event('start')), 50);
    setTimeout(() => {
      const r = [[{ transcript: 'used half the milk and two eggs', confidence: 0.9 }]]; r[0].isFinal = true;
      const e = new Event('result'); e.results = r; e.resultIndex = 0; this.dispatchEvent(e);
      this.dispatchEvent(new Event('end'));
    }, 300);
  }
  stop() {} abort() {}
};
"""
SILENT = "window.webkitSpeechRecognition = class extends EventTarget { start() {} stop() {} abort() {} };"
BLOCKED = """
window.webkitSpeechRecognition = class extends EventTarget {
  start() {
    setTimeout(() => { const e = new Event('error'); e.error = 'not-allowed'; this.dispatchEvent(e); this.dispatchEvent(new Event('end')); }, 50);
  }
  stop() {} abort() {}
};
"""
NONE = "delete window.webkitSpeechRecognition; delete window.SpeechRecognition;"


def _open_voice(page, script):
    page.add_init_script(script)
    open_app(page)
    page.get_by_label('Tell the fridge what you used').click()
    page.wait_for_timeout(300)


def test_speaking_fills_in_the_sentence_and_lists_the_actions(phone):
    _open_voice(phone, HEARS)
    phone.get_by_text('Tap and speak', exact=True).click()
    phone.get_by_text('Used 0.5 L of Milk', exact=True).wait_for(timeout=5000)
    assert phone.get_by_label('What you used or threw out').input_value() == 'used half the milk and two eggs'
    assert phone.get_by_text('Tap and speak', exact=True).count() == 1  # back to idle


@pytest.mark.parametrize('script, says', [
    (SILENT, "speech service isn't answering"),
    (BLOCKED, 'microphone is blocked'),
])
def test_a_speech_problem_is_explained_in_the_sheet_and_listening_stops(phone, script, says):
    _open_voice(phone, script)
    phone.get_by_text('Tap and speak', exact=True).click()
    phone.get_by_role('alert').filter(has_text=says).wait_for(timeout=8000)
    assert phone.get_by_text('Tap and speak', exact=True).count() == 1


def test_without_a_speech_api_it_says_where_voice_works_and_typing_still_does(phone):
    _open_voice(phone, NONE)
    assert phone.get_by_text('Tap and speak', exact=True).count() == 0
    assert phone.get_by_text('Voice works in Chrome, Edge, Safari', exact=False).count() == 1
    phone.get_by_label('What you used or threw out').fill('used two eggs')
    phone.get_by_text('Read it', exact=True).click()
    phone.get_by_text('Used 2 pcs of Eggs', exact=True).wait_for(timeout=5000)
