import Cocoa
import SafariServices

@main
class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow?

    func applicationDidFinishLaunching(_ aNotification: Notification) {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 440, height: 260),
            styleMask: [.titled, .closable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = "StudyBridge for Safari"

        let contentView = NSView(frame: NSRect(x: 0, y: 0, width: 440, height: 260))

        let titleLabel = NSTextField(labelWithString: "StudyBridge for Safari")
        titleLabel.frame = NSRect(x: 20, y: 190, width: 400, height: 30)
        titleLabel.alignment = .center
        titleLabel.font = NSFont.systemFont(ofSize: 18, weight: .bold)
        contentView.addSubview(titleLabel)

        let descLabel = NSTextField(labelWithString: "Capture selected Testbook results and transfer them into your local Study Application.\n\nTo enable StudyBridge, open Safari Settings > Extensions.")
        descLabel.frame = NSRect(x: 40, y: 110, width: 360, height: 60)
        descLabel.alignment = .center
        descLabel.font = NSFont.systemFont(ofSize: 12)
        descLabel.textColor = .secondaryLabelColor
        contentView.addSubview(descLabel)

        let prefButton = NSButton(title: "Open Safari Settings…", target: self, action: #selector(openSafariPreferences))
        prefButton.frame = NSRect(x: 130, y: 50, width: 180, height: 32)
        prefButton.bezelStyle = .rounded
        contentView.addSubview(prefButton)

        window.contentView = contentView
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        self.window = window
    }

    @objc func openSafariPreferences() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: "com.studybridge.safari.extension") { error in
            if let error = error {
                print("Error opening preferences: \(error)")
            }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

