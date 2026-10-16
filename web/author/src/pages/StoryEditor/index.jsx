import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import * as storyApi from "../../utils/storyApi";
import LoadingScreen from "../../components/common/LoadingScreen";
import { Icons } from "../../icons";

import MetadataStep from "./components/MetadataStep";
import TitleStep from "./components/TitleStep";
import ContentStep from "./components/ContentStep";
import MediaStep from "./components/MediaStep";
import VisibilityStep from "./components/VisibilityStep";
import PublishedStep from "./components/PublishedStep";
import UpgradeModal from "./components/UpgradeModal";
import { emptyStory, toStoryEntry } from "./utils";

/**
 * The story writing flow — five steps:
 *
 *   1. Classification — chapter and story type (both selects)
 *   2. Title & banner — the name and the mandatory cover
 *   3. Content        — the story itself, rich text
 *   4. Media          — optional photos / videos
 *   5. Visibility     — audience choice with the final Publish button
 *
 * The wizard autosaves as a draft so a closed tab never loses work, and
 * every screen is one of its own components.
 */
export default function StoryEditorPage() {
  const { storyId } = useParams();
  const [searchParams] = useSearchParams();
  // ?publish=1 → returned from completing the profile; resume publishing
  const wantsPublish = searchParams.get("publish") === "1";

  const { author, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isEditMode = Boolean(storyId);

  // The author as of this session — the upgrade modal hands back a
  // refreshed account carrying isProfileCompleted, so publishing continues
  // without waiting for the provider to refetch.
  const [refreshedAuthor, setRefreshedAuthor] = useState(null);
  const activeAuthor = refreshedAuthor || author;

  const [phase, setPhase] = useState(1);
  const [storyDocId, setStoryDocId] = useState(storyId || null);
  const [bannerImage, setBannerImage] = useState(null);
  const [draft, setDraft] = useState(emptyStory());
  const [loaded, setLoaded] = useState(!isEditMode);
  const [publishing, setPublishing] = useState(false);
  const [savedSlug, setSavedSlug] = useState("");
  // Shown when a not-yet-upgraded account presses Publish: the upgrade
  // form grants the author role, then publishing resumes automatically.
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  /* ---------- Loading ---------- */

  useEffect(() => {
    if (!storyId || !author) return;

    storyApi
      .getMyStory(storyId)
      .then((saved) => {
        setBannerImage(saved.bannerImage || null);
        setDraft({ ...emptyStory(), ...toStoryEntry(saved) });
        // Resume at the final editable step when returning to publish.
        setPhase(wantsPublish ? 5 : 1);
      })
      .catch(() => toast.error("Story not found"))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, author]);

  /* ---------- Saving ---------- */

  /** Creates or updates the flat story document; returns the doc. */
  async function ensureStorySaved({ publish = false } = {}) {
    const payload = {
      ...toStoryEntry(draft),
      ...(bannerImage ? { bannerImage } : {}),
      status: publish ? "published" : "draft",
    };

    if (storyDocId) {
      const saved = await storyApi.update(storyDocId, payload);
      return saved;
    }

    const saved = await storyApi.create(payload);
    const id = saved.id || saved._id;
    setStoryDocId(id);
    const query = searchParams.toString();
    navigate(`/stories/${id}/edit${query ? `?${query}` : ""}`, { replace: true });
    return saved;
  }

  /** Save a draft silently (autosave + on leaving steps). */
  async function handleSaveDraft() {
    try {
      await ensureStorySaved({ publish: false });
    } catch {
      // Silent — draft save is best-effort.
    }
  }

  async function handlePublish() {
    if (bannerImage == null || !bannerImage.url) {
      toast.error("Add a banner before publishing.");
      setPhase(2);
      return;
    }

    // Not upgraded yet → show the publish-time upgrade modal. The draft
    // is saved first so nothing is lost. The local `isAuthor` flag from
    // the upgrade response makes the next Publish click skip the modal —
    // no extra API call to figure out account state.
    if (!activeAuthor?.isAuthor) {
      try {
        await ensureStorySaved({ publish: false });
      } catch {
        // best-effort — the modal still opens
      }
      setUpgradeOpen(true);
      return;
    }

    await doPublish();
  }

  async function doPublish() {
    setPublishing(true);
    try {
      const saved = await ensureStorySaved({ publish: true });
      await storyApi.publish(saved.id || saved._id);

      setSavedSlug(saved.slug || "");
      // Phase 6 is the congratulations screen — phase 5 is still the
      // visibility step, so the success state must move beyond it.
      setPhase(6);
      toast.success("Your story is published!");
    } catch (err) {
      const message =
        err?.response?.data?.error?.message || "Failed to publish story";
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  }

  /** Upgrade succeeded → local state carries isAuthor; modal won't reopen. */
  function handleUpgraded(upgradedAuthor) {
    setUpgradeOpen(false);
    setRefreshedAuthor(upgradedAuthor);
    toast.success("Profile upgraded to author");
  }

  // Autosave: a couple of seconds after typing stops, so a closed tab never
  // loses work. Skipped once published.
  const lastAutosaveRef = useRef("");

  useEffect(() => {
    if (phase > 4) return;
    if (!draft.title?.trim() && !draft.content?.trim()) return;
    if (draft.status === "published") return;

    const signature = `${draft.id || ""}|${draft.title || ""}|${draft.content || ""}|${draft.chapterName || ""}|${draft.storyType || ""}`;
    if (lastAutosaveRef.current === signature) return;

    const timer = setTimeout(() => {
      lastAutosaveRef.current = signature;
      // Persist only once the mandatory fields exist — the backend rejects
      // drafts without title+banner, so half-formed autosaves are skipped.
      if (draft.title?.trim() && bannerImage?.url) {
        handleSaveDraft();
      }
    }, 2000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, draft.id, draft.title, draft.content, draft.chapterName, draft.storyType, bannerImage]);

  /* ---------- Render ---------- */

  if (authLoading || (isEditMode && !loaded)) {
    return <LoadingScreen message="Loading..." />;
  }
  if (!activeAuthor) {
    navigate("/login");
    return null;
  }

  switch (phase) {
    case 1:
      return (
        <MetadataStep
          story={draft}
          onChange={setDraft}
          onContinue={() => {
            setPhase(2);
          }}
          onBack={() => {
            handleSaveDraft();
            navigate("/profile");
          }}
        />
      );

    case 2:
      return (
        <TitleStep
          story={draft}
          onChange={setDraft}
          bannerImage={bannerImage}
          onBannerChange={setBannerImage}
          onContinue={() => {
            setPhase(3);
            handleSaveDraft();
          }}
          onBack={() => setPhase(1)}
        />
      );

    case 3:
      return (
        <ContentStep
          story={draft}
          onChange={setDraft}
          onContinue={() => {
            setPhase(4);
            handleSaveDraft();
          }}
          onBack={() => setPhase(2)}
        />
      );

    case 4:
      return (
        <MediaStep
          story={draft}
          onChange={setDraft}
          onContinue={() => {
            setPhase(5);
            handleSaveDraft();
          }}
          onBack={() => setPhase(3)}
        />
      );

    case 5:
      return (
        <>
          <VisibilityStep
            visibility={draft.visibility}
            onChange={(visibility) => setDraft((d) => ({ ...d, visibility }))}
            hasBanner={Boolean(bannerImage?.url)}
            publishing={publishing}
            onPublish={handlePublish}
            onBack={() => setPhase(4)}
          />

          {upgradeOpen && (
            <UpgradeModal
              author={activeAuthor}
              onUpgraded={handleUpgraded}
              onClose={() => setUpgradeOpen(false)}
            />
          )}
        </>
      );

    case 6:
      return (
        <PublishedStep
          storyUrl={savedSlug ? `/feed/story/${savedSlug}` : ""}
          onAddAnother={() => {
            setDraft(emptyStory());
            setStoryDocId(null);
            setBannerImage(null);
            setSavedSlug("");
            setPhase(1);
          }}
          onGoHome={() => navigate("/my-stories")}
        />
      );

    default:
      return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <button
            type="button"
            onClick={() => setPhase(1)}
            className="rounded-xl bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground"
          >
            Start over
          </button>
        </div>
      );
  }
}
