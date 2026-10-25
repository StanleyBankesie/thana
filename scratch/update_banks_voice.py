import os

def update_modal():
    modal_path = r"c:\Users\stanl\OneDrive\Documents\Stanness Technologies\thana\client\src\components\ai\BanksAiModal.jsx"
    with open(modal_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add VoiceVisualizer import if not present
    if 'import VoiceVisualizer from "./VoiceVisualizer.jsx";' not in content:
        content = content.replace(
            'import { useSpeech } from "./useSpeech.js";',
            'import { useSpeech } from "./useSpeech.js";\nimport VoiceVisualizer from "./VoiceVisualizer.jsx";'
        )

    # 2. Update useSpeech destructuring
    old_destruct = """  const {
    isListening,
    isSpeaking,
    speakingId,
    isVoiceMode,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    toggleSpeak,
    toggleVoiceMode,
  } = useSpeech({"""

    new_destruct = """  const {
    isListening,
    isSpeaking,
    speakingId,
    isVoiceMode,
    speechError,
    audioLevel,
    isTranscribing,
    activeEngine,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    toggleSpeak,
    toggleVoiceMode,
  } = useSpeech({"""

    if old_destruct in content:
        content = content.replace(old_destruct, new_destruct)

    # 3. Add VoiceVisualizer and update Mic button in Prompt Input Box
    target_prompt_box = """        {/* Prompt Input Box */}
        <div className="p-3 md:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
          <form"""

    replacement_prompt_box = """        {/* Prompt Input Box */}
        <div className="p-3 md:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
          {/* Audio Visualizer & Level Indicator */}
          <VoiceVisualizer
            isListening={isListening}
            isSpeaking={isSpeaking}
            isTranscribing={isTranscribing}
            audioLevel={audioLevel}
            activeEngine={activeEngine}
            onStopAndSend={() => {
              stopListening(true);
              if (input.trim()) {
                handleSend();
              }
            }}
          />

          <form"""

    if target_prompt_box in content and "<VoiceVisualizer" not in content:
        content = content.replace(target_prompt_box, replacement_prompt_box)

    # Update Mic button in Modal
    old_mic_btn = """            {/* Speech-to-Text Microphone Button */}
            <button
              type="button"
              onClick={() =>
                toggleListening(
                  (interim) => setInput(interim),
                  (final) => setInput(final)
                )
              }
              disabled={loading}
              className={`p-2.5 rounded-xl transition-all flex items-center justify-center flex-shrink-0 shadow-sm ${
                isListening
                  ? "bg-rose-600 text-white animate-pulse shadow-md scale-105"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 active:scale-95"
              }`}
              title={isListening ? "Stop Listening" : "Voice Input (Speech-to-Text)"}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>"""

    new_mic_btn = """            {/* Speech-to-Text Microphone Button */}
            <button
              type="button"
              onClick={() => {
                if (isListening) {
                  stopListening(true);
                  if (input.trim()) {
                    handleSend();
                  }
                } else {
                  toggleListening(
                    (interim) => setInput(interim),
                    (final) => setInput(final)
                  );
                }
              }}
              disabled={loading}
              className={`p-2.5 rounded-xl transition-all flex items-center justify-center flex-shrink-0 shadow-sm ${
                isListening
                  ? "bg-rose-600 text-white animate-pulse shadow-md scale-105 ring-2 ring-rose-400"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 active:scale-95"
              }`}
              title={isListening ? "Finish & Send (or click to stop)" : "Voice Input (Speech-to-Text)"}
            >
              {isListening ? (
                <div className="flex items-center gap-1">
                  <MicOff size={17} />
                  {audioLevel > 15 && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
                </div>
              ) : (
                <Mic size={18} />
              )}
            </button>"""

    if old_mic_btn in content:
        content = content.replace(old_mic_btn, new_mic_btn)

    with open(modal_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("BanksAiModal.jsx updated successfully!")

def update_page():
    page_path = r"c:\Users\stanl\OneDrive\Documents\Stanness Technologies\thana\client\src\pages\modules\business-intelligence\BanksAiPage.jsx"
    with open(page_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add VoiceVisualizer import if not present
    if 'import VoiceVisualizer from "../../../components/ai/VoiceVisualizer.jsx";' not in content:
        content = content.replace(
            'import { useSpeech } from "../../../components/ai/useSpeech.js";',
            'import { useSpeech } from "../../../components/ai/useSpeech.js";\nimport VoiceVisualizer from "../../../components/ai/VoiceVisualizer.jsx";'
        )

    # 2. Update useSpeech destructuring
    old_destruct = """  const {
    isListening,
    isSpeaking,
    speakingId,
    isVoiceMode,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    toggleSpeak,
    toggleVoiceMode,
  } = useSpeech({"""

    new_destruct = """  const {
    isListening,
    isSpeaking,
    speakingId,
    isVoiceMode,
    speechError,
    audioLevel,
    isTranscribing,
    activeEngine,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    toggleSpeak,
    toggleVoiceMode,
  } = useSpeech({"""

    if old_destruct in content:
        content = content.replace(old_destruct, new_destruct)

    # 3. Add VoiceVisualizer above prompt input
    target_prompt_box = """          {/* Prompt input */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <form"""

    replacement_prompt_box = """          {/* Prompt input */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            {/* Live Audio Visualizer & Level Indicator */}
            <VoiceVisualizer
              isListening={isListening}
              isSpeaking={isSpeaking}
              isTranscribing={isTranscribing}
              audioLevel={audioLevel}
              activeEngine={activeEngine}
              onStopAndSend={() => {
                stopListening(true);
                if (input.trim()) {
                  handleSend();
                }
              }}
            />

            <form"""

    if target_prompt_box in content and "<VoiceVisualizer" not in content:
        content = content.replace(target_prompt_box, replacement_prompt_box)

    # 4. Update Mic button in Page
    old_mic_btn = """              {/* Voice Input (Speech-to-Text) Button */}
              <button
                type="button"
                onClick={() =>
                  toggleListening(
                    (interim) => setInput(interim),
                    (final) => setInput(final)
                  )
                }
                disabled={loading}
                className={`p-3 rounded-xl transition-all flex items-center justify-center flex-shrink-0 shadow-sm ${
                  isListening
                    ? "bg-rose-600 text-white animate-pulse shadow-md scale-105"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 active:scale-95"
                }`}
                title={isListening ? "Stop Microphone" : "Voice Input (Speech-to-Text)"}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>"""

    new_mic_btn = """              {/* Voice Input (Speech-to-Text) Button */}
              <button
                type="button"
                onClick={() => {
                  if (isListening) {
                    stopListening(true);
                    if (input.trim()) {
                      handleSend();
                    }
                  } else {
                    toggleListening(
                      (interim) => setInput(interim),
                      (final) => setInput(final)
                    );
                  }
                }}
                disabled={loading}
                className={`p-3 rounded-xl transition-all flex items-center justify-center flex-shrink-0 shadow-sm ${
                  isListening
                    ? "bg-rose-600 text-white animate-pulse shadow-md scale-105 ring-2 ring-rose-400"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 active:scale-95"
                }`}
                title={isListening ? "Finish & Send (or click to stop)" : "Voice Input (Speech-to-Text)"}
              >
                {isListening ? (
                  <div className="flex items-center gap-1">
                    <MicOff size={18} />
                    {audioLevel > 15 && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
                  </div>
                ) : (
                  <Mic size={18} />
                )}
              </button>"""

    if old_mic_btn in content:
        content = content.replace(old_mic_btn, new_mic_btn)

    with open(page_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("BanksAiPage.jsx updated successfully!")

if __name__ == "__main__":
    update_modal()
    update_page()
