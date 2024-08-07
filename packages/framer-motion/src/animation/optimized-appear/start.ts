import { appearStoreId } from "./store-id"
import { animateStyle } from "../animators/waapi"
import { NativeAnimationOptions } from "../animators/waapi/types"
import { optimizedAppearDataId } from "./data-id"
import { handoffOptimizedAppearAnimation } from "./handoff"
import { appearAnimationStore, elementsWithAppearAnimations } from "./store"
import { noop } from "../../utils/noop"
import "./types"

/**
 * A single time to use across all animations to manually set startTime
 * and ensure they're all in sync.
 */
let startFrameTime: number

/**
 * A dummy animation to detect when Chrome is ready to start
 * painting the page and hold off from triggering the real animation
 * until then. We only need one animation to detect paint ready.
 *
 * https://bugs.chromium.org/p/chromium/issues/detail?id=1406850
 */
let readyAnimation: Animation

export function startOptimizedAppearAnimation(
    element: HTMLElement,
    name: string,
    keyframes: string[] | number[],
    options: NativeAnimationOptions,
    onReady?: (animation: Animation) => void
): void {
    // Prevent optimised appear animations if Motion has already started animating.
    if (window.MotionHandoffIsComplete) {
        window.MotionHandoffAnimation = undefined
        return
    }

    const id = element.dataset[optimizedAppearDataId]

    if (!id) return

    window.MotionHandoffAnimation = handoffOptimizedAppearAnimation

    const storeId = appearStoreId(id, name)
    if (!readyAnimation) {
        readyAnimation = animateStyle(
            element,
            name,
            [keyframes[0] as number, keyframes[0] as number],
            /**
             * 10 secs is basically just a super-safe duration to give Chrome
             * long enough to get the animation ready.
             */
            { duration: 10000, ease: "linear" }
        )

        appearAnimationStore.set(storeId, {
            animation: readyAnimation,
            startTime: null,
        })

        /**
         * If there's no readyAnimation then there's been no instantiation
         * of handoff animations.
         */
        window.MotionHandoffAnimation = handoffOptimizedAppearAnimation

        /**
         * We only need to cancel transform animations as
         * they're the ones that will interfere with the
         * layout animation measurements.
         */
        window.MotionHandoffCancelAll = () => {
            appearAnimationStore.forEach(({ animation }, animationId) => {
                if (animationId.endsWith("transform")) {
                    animation.cancel()
                    appearAnimationStore.delete(animationId)
                }
            })

            window.MotionHandoffCancelAll = undefined
        }

        /**
         * Keep a map of elementIds that have started animating. We check
         * via ID instead of Element because of hydration errors and
         * pre-hydration checks. We also actively record IDs as they start
         * animating rather than simply checking for data-appear-id as
         * this attrbute might be present but not lead to an animation, for
         * instance if the element's appear animation is on a different
         * breakpoint.
         */
        window.MotionHasOptimisedAnimation = (elementId?: string) =>
            Boolean(elementId && elementsWithAppearAnimations.has(elementId))

        window.MotionHasOptimisedTransformAnimation = (elementId?: string) =>
            Boolean(
                elementId &&
                    appearAnimationStore.has(
                        appearStoreId(elementId, "transform")
                    )
            )
    }

    const startAnimation = () => {
        readyAnimation.cancel()

        const appearAnimation = animateStyle(element, name, keyframes, options)

        /**
         * Record the time of the first started animation. We call performance.now() once
         * here and once in handoff to ensure we're getting
         * close to a frame-locked time. This keeps all animations in sync.
         */
        if (startFrameTime === undefined) {
            startFrameTime = performance.now()
        }

        appearAnimation.startTime = startFrameTime

        appearAnimationStore.set(storeId, {
            animation: appearAnimation,
            startTime: startFrameTime,
        })

        if (onReady) onReady(appearAnimation)
    }

    elementsWithAppearAnimations.add(id)

    if (readyAnimation.ready) {
        readyAnimation.ready.then(startAnimation).catch(noop)
    } else {
        startAnimation()
    }
}
