import SafariServices
import os.log

public class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    public func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems[0] as! NSExtensionItem
        let message = item.userInfo?[SFExtensionMessageKey]
        os_log(.default, "StudyBridge Native Extension received: %@", String(describing: message))

        let response = NSExtensionItem()
        response.userInfo = [ SFExtensionMessageKey: [ "status": "StudyBridge Extension Active" ] ]

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}

