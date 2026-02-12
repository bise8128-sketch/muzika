---
name: prompt-enhancer
description: Improve and optimize AI prompts for image generation, code explanation, and creative writing.
metadata:
  version: "1.0.0"
  category: utility
  usage-context: "prompting", "image-gen", "reasoning"
---

# AI Prompt Enhancer

The `prompt-enhancer` skill ensures that all interactions involving AI generation (text or images) are optimized for the highest quality output.

## Core Capabilities

### 1. Image Generation (Diffusion-Style)
When asked to "generate an image" or "design a mockup":
- **Structure**: [Subject] + [Style/Medium] + [Artist/Aesthetic Reference] + [Lighting/Mood] + [Technical Details: 8k, highly detailed].
- **Example**: "A premium glassmorphism music player UI, neon blue and deep purple gradients, ultra-sleek, minimalist, 8k resolution, trending on Dribbble."

### 2. Code Explanation & Documentation
When explaining complex logic:
- Use analogies to make concepts accessible.
- Follow a "What, Why, How" structure.
- Ensure all technical terms are linked to project documentation or glossary.

### 3. Reasoning & Chain of Thought
- When solving complex bugs, use `sequential-thinking` to explore multiple paths.
- Explicitly state assumptions and verify them before proceeding.

## Best Practices
- Avoid ambiguous language in prompts.
- Use negative prompting where supported (e.g., "no blur, no low-res").
- Iteratively refine prompts based on output quality.
