# Prototype Instructions

Before product, research, pitch, or implementation work, read `docs/product/README.md` and follow its source-priority rules. `docs/product/月经宝宝产品方案-v3.0-current.md` is the current product source of truth; archived plans are background only.

For project management, handoff, prioritization, or cross-functional coordination, also read `PROJECT.md` and `docs/project/00-老板驾驶舱.md`. Research tasks must originate from `docs/research/00-研究总计划.md`, and external evidence must be registered in `docs/research/01-证据台账.md`. Keep facts, research findings, inferences, hypotheses, and product decisions explicitly separated.

Product discovery may change priority without erasing product work. Preserve all durable features, interaction details, brand/world concepts, and deferred ideas in the current product plan's product-asset status table. “Deferred” means not in the current build, not deleted. Do not remove a durable product asset without recording the reason in the decision log.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable Product and Design Decisions

- Prioritize a complete, polished “小窝” experience for the hackathon demo; `知识海` and `我的` may remain out of scope rather than appearing deceptively complete.
- Never reuse a generated full-screen UI mock as an image inside another UI. Extract or generate clean illustration assets without baked-in UI text so pages do not look collaged.
- The primary small-nest experience must demonstrate a real Agent conversation: free-text user input, visible understanding/interpretation, and a contextual response. Do not reduce the core Agent experience to only tapping preset options.
- Creature rendering must stay fantastical and softly airbrushed. Blur/simplify pores, skin folds, wrinkles, veins, wet-flesh highlights, muscles, joints, realistic paws, claws, and anatomical detail. Keep the eyes, expression, silhouette, ear-fin edges, shell ornaments, and luminous tail crisp. Avoid animal-realistic surface texture that can feel wrinkled, fleshy, or uncanny.
- The menstrual baby is the primary relationship object, not a decorative illustration. Its habitat should dominate the nest home screen and the initial conversation state. After the user starts a conversation, the hero may collapse smoothly to create room for messages.
- Use plain-language health inputs (`疼痛程度`, `现在的心情`, `现在的精力`) and explain what each choice is based on. Poetic terms such as `身体潮汐` or `能量月相` may appear as atmosphere, not as unexplained form labels.
- The response flow is: feel understood → choose one care action → report whether it helped → save a real outcome → optionally share it as a care gift.
- Knowledge and peer-gift content are secondary expandable support. Sharing success should reward the relationship with the user's baby (growth, remembered care, new visual trait), not primarily abstract contribution points or predicted impact counts.
