import AppKit
import ApplicationServices

// Rewrites Ctrl+Tab / Ctrl+Shift+Tab to Ctrl+Q / Ctrl+Shift+Q while Chrome is frontmost.
let chromeBundleIDs: Set<String> = ["com.google.Chrome", "com.google.Chrome.beta", "com.google.Chrome.canary"]
let tabKey: CGKeyCode = 48
let qKey: CGKeyCode = 12

var eventTap: CFMachPort?
let source = CGEventSource(stateID: .hidSystemState)

func chromeIsFrontmost() -> Bool {
    guard let id = NSWorkspace.shared.frontmostApplication?.bundleIdentifier else { return false }
    return chromeBundleIDs.contains(id)
}

let callback: CGEventTapCallBack = { _, type, event, _ in
    if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
        if let tap = eventTap { CGEvent.tapEnable(tap: tap, enable: true) }
        return Unmanaged.passUnretained(event)
    }
    guard type == .keyDown || type == .keyUp,
          CGKeyCode(event.getIntegerValueField(.keyboardEventKeycode)) == tabKey,
          event.flags.contains(.maskControl),
          !event.flags.contains(.maskCommand),
          !event.flags.contains(.maskAlternate),
          chromeIsFrontmost(),
          let replacement = CGEvent(keyboardEventSource: source, virtualKey: qKey, keyDown: type == .keyDown)
    else { return Unmanaged.passUnretained(event) }
    replacement.flags = event.flags
    replacement.setIntegerValueField(.keyboardEventAutorepeat, value: event.getIntegerValueField(.keyboardEventAutorepeat))
    return Unmanaged.passRetained(replacement)
}

func installTap() -> Bool {
    let mask = CGEventMask(1 << CGEventType.keyDown.rawValue) | CGEventMask(1 << CGEventType.keyUp.rawValue)
    guard let tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .defaultTap,
                                      eventsOfInterest: mask, callback: callback, userInfo: nil) else { return false }
    eventTap = tap
    CFRunLoopAddSource(CFRunLoopGetMain(), CFMachPortCreateRunLoopSource(nil, tap, 0), .commonModes)
    CGEvent.tapEnable(tap: tap, enable: true)
    return true
}

setvbuf(stdout, nil, _IOLBF, 0)
let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
_ = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary)
if installTap() {
    print("event tap active")
} else {
    print("waiting for Accessibility permission")
    Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { timer in
        guard installTap() else { return }
        print("event tap active")
        timer.invalidate()
    }
}
app.run()
