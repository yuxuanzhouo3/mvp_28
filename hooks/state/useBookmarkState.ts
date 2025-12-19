import { useState } from "react";
import type { BookmarkedMessage, BookmarkFolder } from "../../types";

export const useBookmarkState = () => {
  const [bookmarkedMessages, setBookmarkedMessages] = useState<
    BookmarkedMessage[]
  >([]);
  const [bookmarkFolders, setBookmarkFolders] = useState<BookmarkFolder[]>([]);
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(
    null
  );
  const [editingBookmarkName, setEditingBookmarkName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#6B7280");

  return {
    bookmarkedMessages,
    setBookmarkedMessages,
    bookmarkFolders,
    setBookmarkFolders,
    editingBookmarkId,
    setEditingBookmarkId,
    editingBookmarkName,
    setEditingBookmarkName,
    newFolderName,
    setNewFolderName,
    newFolderColor,
    setNewFolderColor,
  };
};
