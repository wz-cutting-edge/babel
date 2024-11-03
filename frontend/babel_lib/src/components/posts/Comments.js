import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { db } from '../../services/firebase/config';
import { collection, query, where, orderBy, addDoc, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, updateDoc, increment, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CommentWrapper = styled.div`
  padding: 1rem 0;
`;

const CommentForm = styled.form`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const CommentInput = styled.input`
  flex: 1;
  padding: 0.5rem;
  border: 1px solid ${props => props.theme.border};
  border-radius: 4px;
`;

const CommentItem = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const CommentAvatar = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
`;

const CommentContent = styled.div`
  flex: 1;
`;

const CommentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;
`;

const CommentAuthor = styled.span`
  font-weight: bold;
`;

const CommentTimestamp = styled.span`
  color: ${props => props.theme.textSecondary};
  font-size: 0.8rem;
`;

const ActionButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  margin-left: 0.5rem;
`;

const Comments = ({ postId, isAdmin }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [usersData, setUsersData] = useState({});
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!postId) return;

    const commentsRef = collection(db, 'comments');
    const q = query(
      commentsRef,
      where('postId', '==', postId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Fetch user data for all commenters
      const userIds = [...new Set(commentsData.map(comment => comment.userId))];
      const usersSnapshot = await Promise.all(
        userIds.map(userId => getDoc(doc(db, 'users', userId)))
      );
      
      const userData = {};
      usersSnapshot.forEach(doc => {
        if (doc.exists()) {
          userData[doc.id] = doc.data();
        }
      });
      
      setUsersData(userData);
      setComments(commentsData);
    });

    return () => unsubscribe();
  }, [postId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    try {
      // Get the current post data
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      
      if (!postSnap.exists()) {
        console.error('Post not found');
        return;
      }

      // Add the comment
      await addDoc(collection(db, 'comments'), {
        postId,
        userId: user.uid,
        content: newComment.trim(),
        createdAt: serverTimestamp()
      });

      // Update the post's comment count
      const currentCount = postSnap.data().commentCount || 0;
      await updateDoc(postRef, {
        commentCount: currentCount + 1
      });

      // Clear the input field
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!isAdmin) return;
    
    try {
      // Get the current post data
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      
      if (!postSnap.exists()) {
        console.error('Post not found');
        return;
      }

      // Delete the comment
      await deleteDoc(doc(db, 'comments', commentId));
      
      // Update the post's comment count
      const currentCount = postSnap.data().commentCount || 0;
      await updateDoc(postRef, {
        commentCount: Math.max(0, currentCount - 1) // Ensure we don't go below 0
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleUserClick = (userId) => {
    navigate(`/profile/${userId}`);
  };

  return (
    <CommentWrapper>
      {user && (
        <CommentForm onSubmit={handleSubmit}>
          <CommentInput
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
          />
          <button type="submit">Post</button>
        </CommentForm>
      )}
      {comments.map(comment => (
        <CommentItem key={comment.id}>
          <CommentAvatar 
            src={usersData[comment.userId]?.photoURL || '/default-avatar.png'} 
            alt={usersData[comment.userId]?.username || 'Anonymous'} 
            onClick={() => handleUserClick(comment.userId)}
            style={{ cursor: 'pointer' }}
          />
          <CommentContent>
            <CommentHeader>
              <div>
                <CommentAuthor 
                  onClick={() => handleUserClick(comment.userId)}
                  style={{ cursor: 'pointer' }}
                >
                  {usersData[comment.userId]?.username || 'Anonymous'}
                </CommentAuthor>
                <CommentTimestamp>
                  {comment.createdAt?.toDate().toLocaleString()}
                </CommentTimestamp>
              </div>
              {isAdmin && (
                <ActionButton onClick={() => handleDeleteComment(comment.id)}>
                  <Trash2 size={16} />
                </ActionButton>
              )}
            </CommentHeader>
            <p>{comment.content}</p>
          </CommentContent>
        </CommentItem>
      ))}
    </CommentWrapper>
  );
};

export default Comments;
