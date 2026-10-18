# iOS: SwiftUI (iOS 26+)

Use Apple's native Liquid Glass (iOS 26+). It gives refraction and specular highlights for free and adapts to accessibility settings.

```swift
struct GlassCard: View {
  @State private var shown = false
  var body: some View {
    ZStack {
      Color(red: 0.03, green: 0.02, blue: 0.05).ignoresSafeArea()
      Circle().fill(Color.orange).frame(width: 320).blur(radius: 90).offset(x: 90, y: 120)
      Circle().fill(Color.pink.opacity(0.7)).frame(width: 240).blur(radius: 80).offset(x: 150, y: 220)

      GlassEffectContainer {
        VStack(alignment: .leading, spacing: 6) {
          Text("MONTHLY RECURRING REVENUE").font(.caption.monospaced()).opacity(0.8)
          Text("$48,210").font(.system(size: 40, weight: .bold)).monospacedDigit()
          Text("+12.4% vs. last month").font(.subheadline).opacity(0.8)
        }
        .foregroundStyle(.white)
        .padding(28)
        .frame(maxWidth: 360, alignment: .leading)
        .glassEffect(.regular.tint(.black.opacity(0.35)).interactive(),
                     in: .rect(cornerRadius: 36))
        .scaleEffect(x: 1, y: shown ? 1 : 0.02)
        .opacity(shown ? 1 : 0)
      }
    }
    .onAppear { withAnimation(.spring(duration: 0.6, bounce: 0.35)) { shown = true } }
  }
}
```

Apple exposes the variant (`.regular`, `.clear`), tint and interactivity, not refraction strength. If the user wants the stronger, tunable look on iOS, port the web shader to a Metal `[[stitchable]]` function and apply it with `.layerEffect(_:maxSampleOffset:)` (iOS 17+). That shader only sees the view it is attached to, so attach it to the container holding both the glow and the card, and compute the card shape inside the shader, as the web version does.

For iOS below 26, fall back to `.background(.ultraThinMaterial, in: .rect(cornerRadius: 36))`.
