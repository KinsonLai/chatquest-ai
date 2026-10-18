# The Last Ferry: model-led session

Actual committed prose and snapshots, 2026-10-18. The Codex assistant supplied both player choices and GM narration, after reading MCP responses. The SDK driver restarted the real stdio server against an isolated SQLite file for each invocation. This is a bounded operating exercise, not an independent blind evaluation or a provider chat-UI test.

[Report](../playtest.md) · [Full MCP requests and responses](ferry-session.json)

Opening: west quay, revision0, Robin has 6 coins, 2 ropes, 1 patch and Jun's borrowed lantern; health10/10 and resolve8/8. No character has read the dispatch.

## Main scene 1

Player: Return Jun's lantern, inspect the mooring with him, and ask whether he heard the warning bell.

Jun takes the lantern from you. 'Thanks. Hold the ring a moment?' He turns the light so you can see the split opening under the ferry's pull. He knows where to put his hands; he keeps them clear of the strained line.

'What about the warning bell?' you ask.

'I don't know when it started. Look, that's coming apart.' He wants you looking at the mooring. Ada pulls the gangplank back before either of you can board.

'Two coins for a replacement ring,' she says. 'I've got one in the hut. You'll need a binding round the mount, too.'

You have six coins, two ropes and a patch. The hut is empty, and the lower steps are still exposed. You can fetch the ring now or look inside first.

```text
[Save] 87b87c12-6015-4023-9db5-3a12de50563b/main · revision 1
[Scene] West quay · elapsed 5 minutes
[health] 10/10
[resolve] 8/8
[Resources] {"coins":6}
[Inventory] {"rope":2,"patch":1}
[Goals] Get Robin, Jun and Ada to the east bank shelter
```

Receipt: committed=true; event `b7a6fe76-2634-46b7-b47b-77abf723d1b7`; state hash `f58a22fd4323bc926699b1b9cf8f8803f03592b6ef0eae56d4cd3cb3803cae85`.

## Main scene 2

Player: Search the empty hut and inspect the wet dispatch privately. Do not tell Ada or Jun its contents.

Server check: d20=2 + 3 = 5, DC12, failure.

You lay the dispatch on the hut's dry counter. The paper comes apart where your thumb lifts the folded corner. For a moment there are several dark strokes; then water carries them into one another.

You can read only 'before the bell'. No gate number survives, and the signature gives you nothing. Seven minutes have gone. You fold the surviving scrap into your coat instead of trying the same damaged section again.

Jun calls from the quay, 'Robin? She wants the ring.' You can see him holding the lantern beside Ada. Neither has come into the hut. There are still two replacement rings on the shelf. You can buy one, leave by the high bridge, or tell Ada exactly how little you recovered.

```text
[Save] 87b87c12-6015-4023-9db5-3a12de50563b/main · revision 2
[Scene] West quay · elapsed 12 minutes
[health] 10/10
[resolve] 8/8
[Resources] {"coins":6}
[Inventory] {"rope":2,"patch":1,"dispatch_scrap":1}
[Goals] Get Robin, Jun and Ada to the east bank shelter
```

Receipt: committed=true; event `8527d87b-4027-470d-a897-14c47c5c1394`; state hash `e84e604c1690bb7f0d3c7394ee3568d6606dc85aece80efa28bf52f20aaaaeba`.

## Main scene 3

Player: Buy one ring for two coins and bind its mount with a rope and patch. Keep the dispatch private.

Server check: d20=13 + 2 = 15, DC12, success.

Ada counts the two coins into her coat and fits the spare ring while you pass the first rope round the mount. You put the patch between the binding and the rough edge, then draw the turns tight.

Jun raises the lantern when Ada asks. 'That bit's slipping,' he says. You pull the loose turn through before she loads the ring. This time it holds. Ada leans her weight against it, lets go, and repeats the test.

The bell sounds from the east bank. Below you, water covers the bottom steps.

'Now,' Ada says. 'Jun, middle bench. Robin, keep your last rope ready for the landing.' You still have four coins, one rope and the dispatch scrap. The ferry can launch; the crossing itself is ahead of you.

```text
[Save] 87b87c12-6015-4023-9db5-3a12de50563b/main · revision 3
[Scene] West quay · elapsed 20 minutes
[health] 10/10
[resolve] 8/8
[Resources] {"coins":4}
[Inventory] {"rope":1,"dispatch_scrap":1}
[Goals] Get Robin, Jun and Ada to the east bank shelter
```

Receipt: committed=true; event `1a75e92f-ed77-40d7-ba6a-d25aa72e4cd1`; state hash `1f10e035da2fc0984177d0c4b239a6e2485b4a51cdb394c20e887ec78e96a37b`.

## Main scene 4

Player: Cross with Ada and Jun. Use the last rope to catch the east-bank bollard, while Jun stays on the middle bench.

Server check: d20=15 + 2 = 17, DC12, success.

Ada pushes the ferry off. Jun sits on the middle bench with the lantern between his feet, watching the rising water clear the boards beneath the gangplank.

At the east-bank steps you cast your remaining rope. Its loop drops behind the bollard. You draw it tight and give Ada the signal; she brings the boat alongside without letting its bow swing into the steps. The rope stays there, securing the ferry.

Jun reaches for the rail. 'Wait,' Ada says. She steps ashore first, then takes the lantern so he can climb with both hands. You follow him onto the landing. Nobody is hurt.

The shelter is above the steps. Ada has its key. You can go in with them, or stop on the landing to discuss the paper you have kept in your coat.

```text
[Save] 87b87c12-6015-4023-9db5-3a12de50563b/main · revision 4
[Scene] East bank landing · elapsed 35 minutes
[health] 10/10
[resolve] 8/8
[Resources] {"coins":4}
[Inventory] {"dispatch_scrap":1}
[Goals] Get Robin, Jun and Ada to the east bank shelter
```

Receipt: committed=true; event `104554e7-cdb7-4f44-bb42-c286fe9ee675`; state hash `3dd0e0a6f87c6d2fa2cdfb95ce7755ee010c5579ddca4da2bb24a3a50446bb99`.

## Main scene 5

Player: Enter the shelter with Ada and Jun. Tell Ada privately that the scrap says only before the bell, and that I could not read a gate or author. Do not pretend I solved the mystery.

Ada unlocks the shelter and lets Jun go ahead with his lantern. He calls back that he is taking the rear room to wring out his sleeves. You wait until he is away from the doorway, then show Ada the scrap.

'Before the bell,' you tell her quietly. 'That's all I could read. No gate number. No name.'

She keeps her hands off the damp paper. 'Then keep it flat. We'll need someone at the office to read it. I'm not accusing anyone over half a sentence.'

Inside, Jun has set his lamp beside his wet jacket. 'Are we staying here?'

'Until the water goes down,' Ada says. She hangs the shelter key beside the door. You put the scrap somewhere dry. All three of you are safe on the east bank; the crossing is finished. Ada now knows what you recovered. Jun knows you brought something in from the hut, but has not heard its words.

```text
[Save] 87b87c12-6015-4023-9db5-3a12de50563b/main · revision 5
[Scene] East bank shelter · elapsed 40 minutes
[health] 10/10
[resolve] 8/8
[Resources] {"coins":4}
[Inventory] {"dispatch_scrap":1}
[Goals] Completed: Robin, Jun and Ada reached the east bank shelter; Optional: take the fragment to the harbour office after the flood
```

Receipt: committed=true; event `e07e38a6-8243-44f4-8f62-b72aff7bb565`; state hash `c7ebe44e5f822350b696bc627d98c04ac83f7a1f9020afc00da3e23379a3dbfa`.

## IF scene 1

Player: Ask Jun to swim across and check the landing before we pay for repairs.

Jun looks from you to the channel. 'No. I'm not swimming that.' He takes the lantern back up the steps. Knowing where a tide mark sits has not made him willing to enter the flood.

Ada steps between the ferry and the quay edge. 'He's staying here. We mend the mount, or we walk the bridge.'

You have not bought a ring or used your repair supplies. The hut is still unsearched in this timeline. Jun's refusal leaves you with a choice of your own: pay for the ferry repair or take the high bridge together.

```text
[Save] 87b87c12-6015-4023-9db5-3a12de50563b/if_9cbefca81e754331999cabdf001170b5 · revision 1
[Scene] West quay · elapsed 6 minutes
[health] 10/10
[resolve] 8/8
[Resources] {"coins":6}
[Inventory] {"rope":2,"patch":1}
[Goals] Get Robin, Jun and Ada to the east bank shelter
```

Receipt: committed=true; event `0a869c82-1b84-4404-b333-72ce92ed508a`; state hash `7329cf829c879a49255b7cc9183e9a3df0bc8e2a525142577470cbd8031e6c1e`.

## IF scene 2

Player: Accept Jun's refusal. Leave the hut unread and take the high footbridge with both companions to the shelter.

'All right. The bridge,' you say. Jun starts up the quay with his lantern while Ada secures the empty ferry at the upper post. You wait for her before leaving the hut behind.

The high footbridge takes thirty minutes. From the middle span you see water moving over the lower steps, but the walking deck stays clear. Jun checks that Ada is following before going on. He does not offer an explanation for the late warning; none of you has read the dispatch in this timeline.

At the shelter, Ada opens the door. Jun goes in first and sets his lamp where its light reaches the benches. You still have all six coins, both ropes and the patch. Everyone has reached the east bank without trying the ferry. The paper in the ticket hut remains unread.

```text
[Save] 87b87c12-6015-4023-9db5-3a12de50563b/if_9cbefca81e754331999cabdf001170b5 · revision 2
[Scene] East bank shelter · elapsed 36 minutes
[health] 10/10
[resolve] 8/8
[Resources] {"coins":6}
[Inventory] {"rope":2,"patch":1}
[Goals] Completed: Robin, Jun and Ada reached the east bank shelter
```

Receipt: committed=true; event `b50d9795-0993-41b7-89de-c5130223d21b`; state hash `2ccb4a0da20a43384908b99e2cccec1de6713778a9f8b0c713d1c69e3be2ed75`.

## Prose review note

The last sentence of main scene5 claims Jun knows Robin brought something from the hut. The session did not explicitly establish his observation of the scrap, and no such knowledge fact was saved. That aside is unsupported and should be deleted when editing the scene. It is retained above because this is an unedited receipt transcript. Jun never receives or speaks the dispatch contents. Database assertions alone did not catch the prose issue; the packaged replay avoids the aside.
