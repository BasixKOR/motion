import { warning } from "motion-utils"
import { isGenerator } from "../generators/utils/is-generator"
import { ResolvedKeyframes } from "../keyframes/KeyframesResolver"
import { AnimationGeneratorType } from "../types"
import { isAnimatable } from "./is-animatable"

function hasKeyframesChanged(keyframes: ResolvedKeyframes<any>) {
    const current = keyframes[0]
    if (keyframes.length === 1) return true
    for (let i = 0; i < keyframes.length; i++) {
        if (keyframes[i] !== current) return true
    }
}

export function canAnimate(
    keyframes: ResolvedKeyframes<any>,
    name?: string,
    type?: AnimationGeneratorType,
    velocity?: number
) {
    /**
     * Check if we're able to animate between the start and end keyframes,
     * and throw a warning if we're attempting to animate between one that's
     * animatable and another that isn't.
     */
    const originKeyframe = keyframes[0]
    if (originKeyframe === null) return false

    /**
     * These aren't traditionally animatable but we do support them.
     * In future we could look into making this more generic or replacing
     * this function with mix() === mixImmediate
     */
    if (name === "display" || name === "visibility") return true

    const targetKeyframe = keyframes[keyframes.length - 1]
    const isOriginAnimatable = isAnimatable(originKeyframe, name)
    const isTargetAnimatable = isAnimatable(targetKeyframe, name)

    warning(
        isOriginAnimatable === isTargetAnimatable,
        `You are trying to animate ${name} from "${originKeyframe}" to "${targetKeyframe}". "${
            isOriginAnimatable ? targetKeyframe : originKeyframe
        }" is not an animatable value.`,
        "value-not-animatable"
    )

    // Always skip if any of these are true
    if (!isOriginAnimatable || !isTargetAnimatable) {
        return false
    }

    return (
        hasKeyframesChanged(keyframes) ||
        ((type === "spring" || isGenerator(type)) && velocity)
    )
}
