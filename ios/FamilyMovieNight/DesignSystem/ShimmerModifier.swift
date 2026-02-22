import SwiftUI

// MARK: - Shimmer Loading Effect
//
// Applied to placeholder skeleton views during loading states.
// Respects reduceMotion — uses static grey when true.

struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .overlay(
                SwiftUI.Group {
                    if !reduceMotion {
                        GeometryReader { geo in
                            LinearGradient(
                                stops: [
                                    .init(color: .clear, location: 0),
                                    .init(color: Color(.systemGray4).opacity(0.6), location: 0.3),
                                    .init(color: .clear, location: 0.6)
                                ],
                                startPoint: .init(x: phase - 0.3, y: 0),
                                endPoint: .init(x: phase, y: 0)
                            )
                        }
                    }
                }
            )
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(
                    .linear(duration: 1.2).repeatForever(autoreverses: false)
                ) {
                    phase = 1.3
                }
            }
    }
}

extension View {
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}

// MARK: - Skeleton placeholder shapes

struct SkeletonRectangle: View {
    var width: CGFloat? = nil
    var height: CGFloat
    var cornerRadius: CGFloat = 8

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(Color(.systemGray5))
            .frame(width: width, height: height)
            .shimmer()
    }
}
