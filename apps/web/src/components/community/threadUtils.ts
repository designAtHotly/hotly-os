import type { CommunityNote } from '@/lib/api';

export type NoteWithChildren = CommunityNote & { children: NoteWithChildren[] };

export function buildHierarchy(notes: CommunityNote[], rootId: string): NoteWithChildren | null {
    const notesById: Record<string, NoteWithChildren> = {};
    notes.forEach(note => {
        notesById[note.uuid] = { ...note, children: [] };
    });

    Object.values(notesById).forEach(note => {
        if (note.parent_uuid && notesById[note.parent_uuid]) {
            notesById[note.parent_uuid].children.push(note);
        }
    });

    Object.values(notesById).forEach(note => {
        note.children.sort((a, b) => {
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
    });

    return notesById[rootId] || null;
}

export function flattenThread(
    note: NoteWithChildren,
    depth = 0,
    path: CommunityNote[] = []
): Array<{ note: NoteWithChildren; depth: number; path: CommunityNote[] }> {
    const currentPath = [...path, note];
    const result: Array<{ note: NoteWithChildren; depth: number; path: CommunityNote[] }> = [
        { note, depth, path: currentPath },
    ];
    note.children.forEach(child => {
        result.push(...flattenThread(child, depth + 1, currentPath));
    });
    return result;
}

export function getNotesById(notes: CommunityNote[]): Record<string, CommunityNote> {
    const map: Record<string, CommunityNote> = {};
    notes.forEach(n => {
        map[n.uuid] = n;
    });
    return map;
}

export function findThreadRoot(notesById: Record<string, CommunityNote>, noteUuid: string): string {
    let currentId = noteUuid;
    let current = notesById[currentId];

    while (current?.parent_uuid && notesById[current.parent_uuid]) {
        currentId = current.parent_uuid;
        current = notesById[currentId];
    }

    return currentId;
}

export function getThreadNotes(notes: CommunityNote[], notesById: Record<string, CommunityNote>, rootId: string): CommunityNote[] {
    const childrenByParentId = new Map<string, string[]>();
    for (const n of notes) {
        if (n.parent_uuid) {
            const siblings = childrenByParentId.get(n.parent_uuid);
            if (siblings) siblings.push(n.uuid);
            else childrenByParentId.set(n.parent_uuid, [n.uuid]);
        }
    }

    const threadNotes: CommunityNote[] = [];
    const visited = new Set<string>();

    function collect(id: string) {
        if (visited.has(id)) return;
        visited.add(id);
        const note = notesById[id];
        if (note) {
            threadNotes.push(note);
            const children = childrenByParentId.get(id);
            if (children) {
                for (const childId of children) {
                    collect(childId);
                }
            }
        }
    }

    collect(rootId);
    return threadNotes;
}
