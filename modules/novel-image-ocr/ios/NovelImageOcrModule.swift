import ExpoModulesCore
import UIKit
import Vision

public class NovelImageOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NovelImageOcr")

    AsyncFunction("recognize") { (localPath: String) throws -> String in
      let url: URL
      if let parsed = URL(string: localPath), parsed.isFileURL {
        url = parsed
      } else {
        url = URL(fileURLWithPath: localPath)
      }
      guard FileManager.default.fileExists(atPath: url.path), let image = UIImage(contentsOfFile: url.path), let cgImage = image.cgImage else {
        throw NSError(domain: "NovelImageOcr", code: 1001, userInfo: [NSLocalizedDescriptionKey: "image_unreadable"])
      }

      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = true
      let availableLanguages = try VNRecognizeTextRequest.supportedRecognitionLanguages(for: .accurate, revision: VNRecognizeTextRequest.currentRevision)
      let preferredLanguages = ["zh-Hans", "en-US"].filter { availableLanguages.contains($0) }
      if preferredLanguages.isEmpty {
        throw NSError(domain: "NovelImageOcr", code: 1002, userInfo: [NSLocalizedDescriptionKey: "language_unavailable"])
      }
      request.recognitionLanguages = preferredLanguages

      let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
      try handler.perform([request])
      let lines = (request.results ?? []).compactMap { observation in
        observation.topCandidates(1).first?.string
      }
      return lines.joined(separator: "\n")
    }
  }
}
