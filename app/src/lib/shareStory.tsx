import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useCallback, useRef, useState } from 'react';
import { Alert, Platform, Share, View, type HostInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { ShareCardImage } from '../components/ShareCardImage';
import { config } from './config';
import type { Story } from './types';

/** Link to the story's FinGist page (rich preview + "Read full story" + "Get the app"). */
export const storyLink = (id: string) => `${config.apiUrl}/s/${id}`;

const PHOTO_WAIT_MS = 2500;

/**
 * One-tap sharing: draws the story as a 9:16 FinGist image (invisible on screen), captures it
 * and opens the phone's share menu with the image and the story link.
 * Returns the hidden image element to render, a `share()` function and a `busy` flag.
 */
export function useShareStory(story: Story) {
  const [rendering, setRendering] = useState(false);
  const [busy, setBusy] = useState(false);
  const shot = useRef<HostInstance>(null);
  const photoReady = useRef<() => void>(() => {});

  const share = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const link = storyLink(story.id);
    const text = `${story.title}\n\nRead more on FinGist: ${link}`;
    try {
      // Draw the share image and wait for its photo (or give up waiting after a moment).
      const ready = new Promise<void>((resolve) => {
        photoReady.current = resolve;
        if (!story.image) setTimeout(resolve, 150);
        setTimeout(resolve, PHOTO_WAIT_MS);
      });
      setRendering(true);
      await ready;
      await new Promise((r) => setTimeout(r, 120)); // let the last frame draw
      if (!shot.current) throw new Error('not ready');
      // The image is invisible on screen; iOS draws it from its layers (works for hidden views).
      const uri = await captureRef(shot.current, { format: 'png', quality: 1, result: 'tmpfile', useRenderInContext: Platform.OS === 'ios' });
      setRendering(false);
      if (Platform.OS === 'ios') {
        // iOS shares the image and the text with the link together.
        await Share.share({ url: uri, message: text });
      } else {
        // Android shares the image; the link is copied so it can be pasted as the message.
        await Clipboard.setStringAsync(link);
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share story' });
      }
    } catch (e) {
      setRendering(false);
      const msg = String((e as Error)?.message ?? '').toLowerCase();
      if (!msg.includes('cancel')) {
        // Fall back to sharing the link as text.
        Share.share({ message: text }).catch(() => Alert.alert('Could not share', 'Please try again.'));
      }
    } finally {
      setBusy(false);
    }
  }, [busy, story]);

  const hiddenImage = rendering ? (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, opacity: 0 }}>
      <ShareCardImage ref={shot} story={story} format="story" link={storyLink(story.id)} onPhotoReady={() => photoReady.current()} />
    </View>
  ) : null;

  return { share, busy, hiddenImage };
}
