import dynamic from 'next/dynamic';
import NoteThreadView from './NoteThreadView';
import MobileMenuDrawer from './MobileMenuDrawer';
import ToastNotification from './ToastNotification';
import DomeNudgeToast from './DomeNudgeToast';
import * as pageHelper from '@/lib/utils/page-helper';
import type { CommunityState } from './useCommunityState';

const ComposeNote = dynamic(() => import('./ComposeNote'), { loading: () => null, ssr: false });
const AuthModal = dynamic(() => import('./AuthModal'), { loading: () => null, ssr: false });
const CreatePrompt = dynamic(() => import('./CreatePrompt'), { loading: () => null, ssr: false });
const ShareNoteModal = dynamic(() => import('./ShareNoteModal'), { loading: () => null, ssr: false });
const DomeOnboarding = dynamic(() => import('../dome/DomeOnboarding'), { loading: () => null, ssr: false });
const DomeCelebration = dynamic(() => import('./DomeCelebration'), { loading: () => null, ssr: false });
const DomeExplainerSheet = dynamic(() => import('./DomeExplainerSheet'), { loading: () => null, ssr: false });
const DomeShareSheet = dynamic(() => import('./DomeShareSheet'), { loading: () => null, ssr: false });

// ─── Modal Layer (routes overlay type → component) ──────
function ModalLayer({ pageState, onCelebrationClose }: { pageState: CommunityState; onCelebrationClose?: () => void }) {
    switch (pageState.overlay.type) {
        case 'thread':
            return (
                <NoteThreadView
                    notes={pageState.notes}
                    selectedNote={pageState.overlay.note}
                    onReply={pageState.handleReply}
                    onShare={pageState.handleShare}
                    onClose={pageState.handleCloseThread}
                    onCreateDome={!pageState.isCreator ? pageState.handleStartDomeCreation : undefined}
                />
            );
        case 'composer':
            return (
                <ComposeNote
                    onAdd={pageState.handleAddNote}
                    onClose={pageState.handleCloseOverlay}
                    replyToNote={pageState.overlay.replyTo}
                    creatorName={pageState.creatorName}
                    creatorUsername={pageState.creatorSlug}
                    creatorVariant={pageState.creatorVariant}
                    promptText={pageState.promptText}
                />
            );
        case 'auth':
            return (
                <AuthModal
                    onSuccess={pageState.handleAuthSuccess}
                    onClose={pageState.handleCloseOverlay}
                    creatorName={pageState.creatorName}
                />
            );
        case 'share':
            if (pageState.overlay.note) {
                return (
                    <ShareNoteModal
                        note={pageState.overlay.note}
                        prompt={pageState.prompt}
                        creatorName={pageState.creatorName}
                        creatorSlug={pageState.creatorSlug}
                        creatorAvatar={pageState.creatorAvatar}
                        onClose={pageState.handleCloseOverlay}
                        onToast={pageState.setToastMessage}
                    />
                );
            }
            return (
                <DomeShareSheet
                    domeShareUrl={pageHelper.getCommunityPromptShareUrl(pageState.creatorSlug, pageState.prompt?.share_slug || '')}
                    onClose={pageState.handleCloseOverlay}
                    isMobile={pageState.isMobile}
                    f={pageState.f}
                />
            );
        case 'createPrompt':
            return (
                <CreatePrompt
                    onSubmit={pageState.handleCreatePrompt}
                    onClose={pageState.handleCloseOverlay}
                />
            );
        case 'createDome':
            return (
                <DomeOnboarding
                    onClose={pageState.handleCloseOverlay}
                    source="community"
                    referralUsername={pageState.creatorSlug}
                />
            );
        case 'domeExplainer':
            return (
                <DomeExplainerSheet
                    onClose={pageState.handleCloseOverlay}
                    onCreateDome={() => {
                        if (pageState.currentUser) {
                            pageState.setOverlay({ type: 'createDome' });
                        } else {
                            pageState.setOverlay({ type: 'auth', pendingAction: 'createDome' });
                        }
                    }}
                    f={pageState.f}
                />
            );
        case 'celebration':
            return (
                <DomeCelebration
                    promptContent={pageState.overlay.promptContent}
                    onClose={() => { pageState.handleCloseOverlay(); onCelebrationClose?.(); }}
                />
            );
        default:
            return null;
    }
}

// ─── Main Export ─────────────────────────────────────────
export default function CommunityOverlays({ pageState, onCelebrationClose }: { pageState: CommunityState; onCelebrationClose?: () => void }) {
    return (
        <>
            {pageState.isMobile && (
                <MobileMenuDrawer
                    isOpen={pageState.overlay.type === 'mobileMenu'}
                    onClose={pageState.handleCloseOverlay}
                    user={pageState.userMenuData}
                    onLogout={pageState.signOut}
                    onLogin={() => pageState.setOverlay({ type: 'auth' })}
                    onCreatePrompt={pageState.isCreator ? () => pageState.setOverlay({ type: 'createPrompt' }) : undefined}
                    penpalUrl={pageHelper.getCreatorVariantPage(pageState.creatorSlug, pageState.creatorVariant)}
                    activeFilter={pageState.activeFilter}
                    onFilterChange={pageState.handleMobileFilterChange}
                    creatorName={pageState.creatorName}
                    prompts={pageState.allPrompts}
                    selectedPrompt={pageState.prompt}
                    onSelectPrompt={pageState.handleMobileSelectPrompt}
                    loadingNotes={pageState.loadingNotes}
                />
            )}

            <ModalLayer pageState={pageState} onCelebrationClose={onCelebrationClose} />

            {pageState.toastMessage && (
                <ToastNotification
                    message={pageState.toastMessage}
                    fontSize={pageState.f.caption}
                    onDismiss={() => pageState.setToastMessage(null)}
                />
            )}

            {pageState.domeNudge && (
                <DomeNudgeToast
                    message="You could hear from your own people too."
                    fontSize={pageState.f.body}
                    onAction={() => {
                        pageState.setDomeNudge(false);
                        pageState.handleStartDomeCreation();
                    }}
                    onDismiss={() => pageState.setDomeNudge(false)}
                />
            )}
        </>
    );
}
