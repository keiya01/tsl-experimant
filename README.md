# TSL experiment

I experimented TSL following https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/.

In this article, he didn't use MRT, but I tried to use MRT. You can just write it like below, thanks to TSL.

```ts
const { outputNode, depthTexture, normalTexture } = useMemo(() => {
  const scenePass = pass(scene, camera).setMRT(
    mrt({
      output: output, // Need to set `output`.
      normal: directionToColor(normalView),
    })
  );
  const scenePassColor = scenePass.getTextureNode("output");
  const depthTexture = scenePass.getTextureNode("depth");
  const normalTexture = scenePass.getTextureNode("normal");

  const outputNode = scenePassColor;

  return {
    outputNode,
    depthTexture,
    normalTexture,
  };
}, [scene, camera]);
```
