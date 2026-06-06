Add-Type -AssemblyName System.Speech
$synthesizer = New-Object -TypeName System.Speech.Synthesis.SpeechSynthesizer
$synthesizer.SelectVoiceByHints('Female')
$synthesizer.SetOutputToWaveFile("$PWD\android\app\src\main\res\raw\voice_alarm.wav")
$synthesizer.Speak("It's time to take your medicine.")
$synthesizer.Dispose()
