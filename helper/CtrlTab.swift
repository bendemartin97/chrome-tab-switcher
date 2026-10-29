import AppKit
import ApplicationServices

// While Chrome is frontmost, rewrites shortcuts Chrome keeps for itself to the extension's commands:
// Ctrl+(Shift+)Tab -> Ctrl+(Shift+)Q (tab switcher), Cmd+Shift+C -> Ctrl+Shift+C (copy URL).
let chromeBundleIDs: Set<String> = ["com.google.Chrome", "com.google.Chrome.beta", "com.google.Chrome.canary"]
let tabKey: CGKeyCode = 48
let qKey: CGKeyCode = 12
let cKey: CGKeyCode = 8
let modifierMask: CGEventFlags = [.maskControl, .maskCommand, .maskAlternate, .maskShift]

var eventTap: CFMachPort?
let source = CGEventSource(stateID: .hidSystemState)

func rewrite(_ key: CGKeyCode, _ flags: CGEventFlags) -> (CGKeyCode, CGEventFlags)? {
    let modifiers = flags.intersection(modifierMask)
    if key == tabKey && (modifiers == [.maskControl] || modifiers == [.maskControl, .maskShift]) {
        return (qKey, flags)
    }
    if key == cKey && modifiers == [.maskCommand, .maskShift] {
        return (cKey, flags.subtracting(.maskCommand).union(.maskControl))
    }
    return nil
}

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
          let (key, flags) = rewrite(CGKeyCode(event.getIntegerValueField(.keyboardEventKeycode)), event.flags),
          chromeIsFrontmost(),
          let replacement = CGEvent(keyboardEventSource: source, virtualKey: key, keyDown: type == .keyDown)
    else { return Unmanaged.passUnretained(event) }
    replacement.flags = flags
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
