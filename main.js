import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, deleteDoc, doc, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCx0W_RtG4QJudOCiE5gecoyQSU4k6XIak",
  authDomain: "x7c-clan-website.firebaseapp.com",
  projectId: "x7c-clan-website",
  storageBucket: "x7c-clan-website.firebasestorage.app",
  messagingSenderId: "943004834091",
  appId: "1:943004834091:web:c28f86c3693035e9664d6e",
  measurementId: "G-GJTKW6XE5P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// 全域紀錄登入者狀態
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  /* ===================== */
  /* Firebase Auth Logic   */
  /* ===================== */
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userInfo = document.getElementById('userInfo');
  const userName = document.getElementById('userName');
  const userPhoto = document.getElementById('userPhoto');

  // Login
  loginBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => {
      console.error("登入錯誤:", error);
    });
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    signOut(auth).catch((error) => {
      console.error("登出錯誤:", error);
    });
  });

  // 管理員白名單 (統一使用小寫以便比對)
  const adminEmails = [
    'hortonchang@gmail.com',
    '111306@thps.tp.edu.tw',
    'nightpopyt@gmail.com'
  ];

  // Auth State Observer
  onAuthStateChanged(auth, (user) => {
    currentUser = user; // 儲存全域狀態供留言板使用
    const editRosterBtn = document.getElementById('editRosterBtn');
    const editTBoardBtn = document.getElementById('editTBoardBtn');
    const loginPrompt = document.getElementById('loginPrompt');
    const inputControls = document.getElementById('inputControls');
    const adminChatControls = document.getElementById('adminChatControls');
    const postComposer = document.getElementById('post-composer');

    if (user) {
      // 登入狀態
      loginBtn.style.display = 'none';
      userInfo.style.display = 'flex';
      userName.textContent = user.displayName || user.email;
      userPhoto.style.display = 'block';
      if(user.photoURL) userPhoto.src = user.photoURL;

      // 留言板輸入框
      if (loginPrompt) loginPrompt.style.display = 'none';
      if (inputControls) inputControls.style.display = 'flex';

      // 檢查是否為管理員
      if (user.email && adminEmails.includes(user.email.toLowerCase())) {
        if(editRosterBtn) editRosterBtn.style.display = 'inline-block';
        if(editTBoardBtn) editTBoardBtn.style.display = 'inline-block';
        if(adminChatControls) adminChatControls.style.display = 'block';
        if(postComposer) postComposer.style.display = 'block';
      } else {
        if(editRosterBtn) editRosterBtn.style.display = 'none';
        if(editTBoardBtn) editTBoardBtn.style.display = 'none';
        if(adminChatControls) adminChatControls.style.display = 'none';
        if(postComposer) postComposer.style.display = 'none';
      }
    } else {
      // 未登入狀態
      loginBtn.style.display = 'inline-block';
      userInfo.style.display = 'none';

      // 隱藏輸入框，提示需登入
      if (loginPrompt) loginPrompt.style.display = 'block';
      if (inputControls) inputControls.style.display = 'none';

      // 隱藏管理按鈕
      if(editRosterBtn) editRosterBtn.style.display = 'none';
      if(editTBoardBtn) editTBoardBtn.style.display = 'none';
      if(adminChatControls) adminChatControls.style.display = 'none';
      if(postComposer) postComposer.style.display = 'none';
    }
  });

  /* ===================== */
  /* Navbar Scroll Effect  */
  /* ===================== */
  const navbar = document.querySelector('.navbar');
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  /* ===================== */
  /* Scroll Progress Bar   */
  /* ===================== */
  window.addEventListener("scroll", () => {
    const scrollTop = document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const percent = (scrollTop / height) * 100;

    const bar = document.getElementById("scroll-bar");
    if (bar) bar.style.width = percent + "%";
  });

  /* ===================== */
  /* Scroll Reveal Anim    */
  /* ===================== */
  const reveals = document.querySelectorAll('.reveal');

  const revealOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
  };

  const revealOnScroll = new IntersectionObserver(function(entries, observer) {
    entries.forEach(entry => {
      if (!entry.isIntersecting) {
        return;
      } else {
        entry.target.classList.add('active');
        observer.unobserve(entry.target); // 動畫只播放一次
      }
    });
  }, revealOptions);

  reveals.forEach(reveal => {
    revealOnScroll.observe(reveal);
  });

  /* ===================== */
  /* Realtime Data Sync    */
  /* ===================== */
  let roster = [];
  let tboard = [];
  
  const rosterGrid = document.getElementById('roster-grid');
  let isEditMode = false;
  const tboardContainer = document.getElementById('tboard-container');
  let isTBoardEditMode = false;

  // 監聽雲端資料變化 (自動同步)
  onSnapshot(doc(db, "siteData", "lists"), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.roster) roster = data.roster;
      if (data.tboard) tboard = data.tboard;
    } else {
      // 若文件不存在，可選擇初始化為空陣列
      setDoc(doc(db, "siteData", "lists"), { roster: [], tboard: [] });
    }
    // 資料更新後重新渲染畫面
    renderRoster();
    renderTBoard();
  }, (error) => {
    console.error("監聽名單與 T榜錯誤:", error);
    rosterGrid.innerHTML = `<div style="color: red; grid-column: 1 / -1;">資料庫連線錯誤：${error.message}<br>如果是權限問題，請檢查 Firebase Console 的 Security Rules。</div>`;
  });

  // 儲存至雲端的函式
  async function saveRoster() {
    try {
      await setDoc(doc(db, "siteData", "lists"), { roster: roster }, { merge: true });
    } catch(e) {
      console.error("儲存名單失敗:", e);
      alert("儲存名單失敗，請檢查權限！");
    }
  }

  async function saveTBoard() {
    try {
      await setDoc(doc(db, "siteData", "lists"), { tboard: tboard }, { merge: true });
    } catch(e) {
      console.error("儲存 T榜失敗:", e);
      alert("儲存 T榜失敗，請檢查權限！");
    }
  }

  /* ===================== */
  /* Roster Management     */
  /* ===================== */

  function renderRoster() {
    rosterGrid.innerHTML = '';
    roster.forEach((member, index) => {
      // 根據角色決定一些樣式顏色（可選），這裡簡單套用統一卡片
      const delay = (index % 5) * 100;
      const card = document.createElement('div');
      card.className = `roster-card reveal active ${isEditMode ? 'edit-mode' : ''}`;
      card.style.transitionDelay = `${delay}ms`;
      
      card.innerHTML = `
        <button class="delete-btn" data-index="${index}">&times;</button>
        <div class="role-badge">${member.role}</div>
        <div class="player-name">${member.name}</div>
      `;
      rosterGrid.appendChild(card);
    });

    // 綁定刪除按鈕事件
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = e.target.getAttribute('data-index');
        roster.splice(idx, 1);
        saveRoster();
      });
    });
  }


  /* ===================== */
  /* Modal & Edit Logic    */
  /* ===================== */
  const modal = document.getElementById('rosterModal');
  const editBtn = document.getElementById('editRosterBtn');
  const closeBtn = document.querySelector('.close-btn');
  const addBtn = document.getElementById('addMemberBtn');

  // 切換編輯模式與開啟 Modal
  editBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    if (isEditMode) {
      editBtn.innerText = '✅ 完成管理';
      editBtn.classList.remove('outline');
      modal.classList.add('show');
    } else {
      editBtn.innerText = '⚙️ 管理名單';
      editBtn.classList.add('outline');
    }
    renderRoster(); // 重新渲染以顯示/隱藏刪除按鈕
  });

  // 關閉 Modal 但保持編輯模式
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('show');
  });

  // 點擊 Modal 外圍關閉
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('show');
    }
  });

  // 新增成員
  addBtn.addEventListener('click', () => {
    const role = document.getElementById('memberRole').value;
    const name = document.getElementById('memberName').value.trim();

    if (name) {
      roster.push({ role, name });
      saveRoster();
      document.getElementById('memberName').value = ''; // 清空輸入框
      modal.classList.remove('show'); // 新增後關閉 Modal (可選)
    } else {
      alert('請輸入玩家 ID！');
    }
  });

  /* ===================== */
  /* T-Board Management    */
  /* ===================== */
  // 定義 Tier 順序以便排序
  const tierOrder = { 'T0': 0, 'T0.5': 1, 'T1': 2, 'T2': 3, 'T3': 4, 'T4': 5 };

  function renderTBoard() {
    tboardContainer.innerHTML = '';
    
    // 將資料依據 Tier 分群
    const grouped = {};
    tboard.forEach((member, index) => {
      if (!grouped[member.tier]) {
        grouped[member.tier] = [];
      }
      grouped[member.tier].push({ ...member, originalIndex: index });
    });

    // 取得所有存在的 Tier 並依照 tierOrder 排序
    const sortedTiers = Object.keys(grouped).sort((a, b) => tierOrder[a] - tierOrder[b]);

    sortedTiers.forEach(tier => {
      // 轉換 Tier 字串做為 CSS class，例如 T0.5 變成 T0-5
      const tierClass = tier.replace('.', '-');

      const groupDiv = document.createElement('div');
      groupDiv.className = 'tier-group reveal active';
      
      const title = document.createElement('h3');
      title.className = `tier-title tier-${tierClass}`;
      title.innerText = tier + ' 階級';
      groupDiv.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'tboard-grid';

      grouped[tier].forEach(member => {
        const card = document.createElement('div');
        card.className = `tboard-card tier-${tierClass} ${isTBoardEditMode ? 'edit-mode' : ''}`;
        
        card.innerHTML = `
          <button class="delete-btn" data-index="${member.originalIndex}">&times;</button>
          <div class="player-name">${member.name}</div>
        `;
        grid.appendChild(card);
      });

      groupDiv.appendChild(grid);
      tboardContainer.appendChild(groupDiv);
    });

    // 綁定 T榜刪除事件
    tboardContainer.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = e.target.getAttribute('data-index');
        tboard.splice(idx, 1);
        saveTBoard();
      });
    });
  }


  /* ===================== */
  /* T-Board Modal Logic   */
  /* ===================== */
  const tboardModal = document.getElementById('tboardModal');
  const editTBoardBtn = document.getElementById('editTBoardBtn');
  const closeTBoardModal = document.getElementById('closeTBoardModal');
  const addTBoardBtn = document.getElementById('addTBoardBtn');

  editTBoardBtn.addEventListener('click', () => {
    isTBoardEditMode = !isTBoardEditMode;
    if (isTBoardEditMode) {
      editTBoardBtn.innerText = '✅ 完成管理';
      editTBoardBtn.classList.remove('outline');
      tboardModal.classList.add('show');
    } else {
      editTBoardBtn.innerText = '⚙️ 管理 T榜';
      editTBoardBtn.classList.add('outline');
    }
    renderTBoard();
  });

  closeTBoardModal.addEventListener('click', () => {
    tboardModal.classList.remove('show');
  });

  window.addEventListener('click', (e) => {
    if (e.target === tboardModal) {
      tboardModal.classList.remove('show');
    }
  });

  addTBoardBtn.addEventListener('click', () => {
    const tier = document.getElementById('tboardTier').value;
    const name = document.getElementById('tboardName').value.trim();

    if (name) {
      tboard.push({ tier, name });
      saveTBoard();
      document.getElementById('tboardName').value = '';
      tboardModal.classList.remove('show');
    } else {
      alert('請輸入玩家 ID！');
    }
  });

  /* ===================== */
  /* Realtime Message Board*/
  /* ===================== */
  const commentsList = document.getElementById('comments-list');
  const commentInput = document.getElementById('commentInput');
  const sendCommentBtn = document.getElementById('sendCommentBtn');

  // 即時監聽 Firestore
  if (commentsList) {
    const q = query(collection(db, "comments"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
      commentsList.innerHTML = '';
      snapshot.forEach((doc) => {
        const data = doc.data();
        // 格式化時間
        const timeString = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleString() : '剛剛';
        const defaultAvatar = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

        let avatarStyle = "";
        if (data.authorEmail && data.authorEmail.toLowerCase() === 'hortonchang@gmail.com') {
          avatarStyle = 'style="display: none;"';
        }

        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment-item';
        commentDiv.innerHTML = `
          <img class="comment-avatar" src="${data.authorPhoto || defaultAvatar}" alt="avatar" ${avatarStyle}>
          <div class="comment-content">
            <div class="comment-author">
              ${data.authorName} <span class="comment-time">${timeString}</span>
            </div>
            <div class="comment-text">${data.text}</div>
          </div>
        `;
        commentsList.appendChild(commentDiv);
      });
      // 捲動到最新留言
      commentsList.scrollTop = commentsList.scrollHeight;
    }, (error) => {
      console.error("Firestore 監聽錯誤:", error);
      commentsList.innerHTML = `<div style="color: red; padding: 20px;">讀取留言失敗：${error.message}<br>這通常是因為資料庫權限沒有開，或是需要建立索引。</div>`;
    });
  }

  // 送出留言
  if (sendCommentBtn) {
    sendCommentBtn.addEventListener('click', async () => {
      const text = commentInput.value.trim();
      if (!text) return;
      if (!currentUser) {
        alert("請先登入才能留言！");
        return;
      }

      // 停用按鈕防連點
      sendCommentBtn.disabled = true;
      sendCommentBtn.innerText = '傳送中...';

      try {
        await addDoc(collection(db, "comments"), {
          text: text,
          authorName: currentUser.displayName || currentUser.email.split('@')[0],
          authorPhoto: currentUser.photoURL || null,
          authorEmail: currentUser.email,
          timestamp: serverTimestamp()
        });
        commentInput.value = '';
      } catch (e) {
        console.error("Error adding comment: ", e);
        alert("留言發送失敗！");
      } finally {
        sendCommentBtn.disabled = false;
        sendCommentBtn.innerText = '送出';
      }
    });
  }

  // 清除所有留言 (管理員專用)
  const clearCommentsBtn = document.getElementById('clearCommentsBtn');
  if (clearCommentsBtn) {
    clearCommentsBtn.addEventListener('click', async () => {
      if (confirm('警告：您確定要清除所有的留言嗎？這將無法復原。')) {
        try {
          clearCommentsBtn.disabled = true;
          clearCommentsBtn.innerText = '清除中...';
          const snapshot = await getDocs(collection(db, "comments"));
          snapshot.forEach(async (document) => {
            await deleteDoc(doc(db, "comments", document.id));
          });
          // 因有 onSnapshot 監聽，畫面會自動更新清空
        } catch (e) {
          console.error("Error clearing comments:", e);
          alert("清除留言失敗！");
        } finally {
          clearCommentsBtn.disabled = false;
          clearCommentsBtn.innerText = '🗑️ 清除所有留言';
        }
      }
    });
  }

  /* ===================== */
  /* Posts Board (貼文區)  */
  /* ===================== */
  const submitPostBtn = document.getElementById('submitPostBtn');
  const postInput = document.getElementById('postInput');
  const postImageUrl = document.getElementById('postImageUrl');
  const postsFeed = document.getElementById('posts-feed');
  const addPollOptionBtn = document.getElementById('addPollOptionBtn');
  const pollOptionsContainer = document.getElementById('poll-options-container');

  // 0. 新增投票選項按鈕邏輯
  if (addPollOptionBtn && pollOptionsContainer) {
    addPollOptionBtn.addEventListener('click', () => {
      const optionCount = pollOptionsContainer.children.length + 1;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'poll-option-input';
      input.placeholder = `選項 ${optionCount}`;
      input.style = 'width: 100%; background: #111; color: white; border: 1px solid #555; padding: 6px; border-radius: 4px; outline: none; margin-top: 8px;';
      pollOptionsContainer.appendChild(input);
    });
  }

  // 1. 發佈貼文
  if (submitPostBtn && postInput) {
    submitPostBtn.addEventListener('click', async () => {
      const content = postInput.value.trim();
      if (!content) {
        alert("請輸入貼文內容！");
        return;
      }
      
      const imageUrl = postImageUrl ? postImageUrl.value.trim() : '';
      
      const pollOptions = [];
      if (pollOptionsContainer) {
        const inputs = pollOptionsContainer.querySelectorAll('.poll-option-input');
        inputs.forEach(input => {
          if (input.value.trim() !== '') {
            pollOptions.push({ text: input.value.trim(), votes: [] });
          }
        });
      }

      try {
        submitPostBtn.disabled = true;
        submitPostBtn.innerText = '發佈中...';
        
        const postData = {
          content: content,
          authorName: currentUser.displayName || currentUser.email.split('@')[0],
          authorPhoto: currentUser.photoURL || null,
          authorEmail: currentUser.email,
          timestamp: serverTimestamp()
        };

        if (imageUrl !== '') {
          postData.imageUrl = imageUrl;
        }

        if (pollOptions.length >= 2) {
          postData.pollOptions = pollOptions;
        }
        
        await addDoc(collection(db, "posts"), postData);
        
        postInput.value = '';
        if (postImageUrl) postImageUrl.value = '';
        if (pollOptionsContainer) {
          pollOptionsContainer.innerHTML = `
            <input type="text" class="poll-option-input" placeholder="選項 1" style="width: 100%; background: #111; color: white; border: 1px solid #555; padding: 6px; border-radius: 4px; outline: none;">
            <input type="text" class="poll-option-input" placeholder="選項 2" style="width: 100%; background: #111; color: white; border: 1px solid #555; padding: 6px; border-radius: 4px; outline: none; margin-top: 8px;">
          `;
        }
      } catch (e) {
        console.error("發佈貼文失敗: ", e);
        alert("發佈貼文失敗！");
      } finally {
        submitPostBtn.disabled = false;
        submitPostBtn.innerText = '發佈貼文';
      }
    });
  }

  // 2. 即時讀取貼文與渲染
  if (postsFeed) {
    const qPosts = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    onSnapshot(qPosts, (snapshot) => {
      postsFeed.innerHTML = '';
      snapshot.forEach((documentSnapshot) => {
        const post = documentSnapshot.data();
        const dateObj = post.timestamp ? post.timestamp.toDate() : new Date();
        const timeString = dateObj.toLocaleString();
        const photoUrl = post.authorPhoto || 'logo.png';
        
        // 特定帳號不顯示真實頭像
        let avatarHtml = `<img src="${photoUrl}" alt="Avatar" class="post-avatar">`;
        if (post.authorEmail && post.authorEmail.toLowerCase() === 'hortonchang@gmail.com') {
          avatarHtml = `<div class="post-avatar" style="background: #333; display: flex; align-items: center; justify-content: center; font-size: 1rem; font-weight: bold; color: #fff;">H</div>`;
        }

        // 刪除按鈕 (僅限管理員)
        const isPostAdmin = currentUser && currentUser.email && adminEmails.includes(currentUser.email.toLowerCase());
        const deleteBtnHtml = isPostAdmin ? `<button class="delete-post-btn" data-post-id="${documentSnapshot.id}" title="刪除貼文">🗑️</button>` : '';

        // 圖片渲染
        let imageHtml = '';
        if (post.imageUrl) {
          imageHtml = `<img src="${post.imageUrl}" class="post-image" alt="Post Image">`;
        }

        // 投票渲染
        let pollHtml = '';
        if (post.pollOptions && post.pollOptions.length > 0) {
          let totalVotes = 0;
          let userVoted = false;
          post.pollOptions.forEach(opt => {
            totalVotes += opt.votes.length;
            if (currentUser && opt.votes.includes(currentUser.email)) {
              userVoted = true;
            }
          });

          let pollOptionsHtml = '';
          post.pollOptions.forEach((opt, idx) => {
            if (userVoted || !currentUser) {
              // 顯示長條圖
              const percentage = totalVotes === 0 ? 0 : Math.round((opt.votes.length / totalVotes) * 100);
              pollOptionsHtml += `
                <div class="poll-result-item">
                  <div class="poll-result-label">
                    <span>${opt.text} ${opt.votes.includes(currentUser?.email) ? '✅' : ''}</span>
                    <span>${percentage}%</span>
                  </div>
                  <div class="poll-result-bar-bg">
                    <div class="poll-result-bar-fill" style="width: ${percentage}%"></div>
                  </div>
                </div>
              `;
            } else {
              // 顯示可投票按鈕
              pollOptionsHtml += `
                <button class="poll-option-btn" data-post-id="${documentSnapshot.id}" data-option-idx="${idx}">${opt.text}</button>
              `;
            }
          });

          let voteCountHtml = `<div style="font-size: 0.8rem; color: #888; margin-top: 10px; text-align: right;">總共 ${totalVotes} 票</div>`;
          pollHtml = `<div class="poll-container">${pollOptionsHtml}${voteCountHtml}</div>`;
        }

        const card = document.createElement('div');
        card.className = 'post-card';
        card.innerHTML = `
          <div class="post-header">
            ${avatarHtml}
            <div class="post-info">
              <span class="post-author">${post.authorName}</span>
              <span class="post-time">${timeString}</span>
            </div>
            ${deleteBtnHtml}
          </div>
          <div class="post-content">${post.content}</div>
          ${imageHtml}
          ${pollHtml}
        `;
        postsFeed.appendChild(card);
      });
    }, (error) => {
      console.error("讀取貼文失敗: ", error);
      postsFeed.innerHTML = `<div style="color:red; text-align:center;">貼文載入失敗：${error.message}</div>`;
    });

    // 3. 事件委派：處理刪除與投票
    postsFeed.addEventListener('click', async (e) => {
      // 刪除貼文
      if (e.target.classList.contains('delete-post-btn')) {
        const postId = e.target.getAttribute('data-post-id');
        if (confirm("警告：您確定要刪除這篇貼文嗎？")) {
          try {
            await deleteDoc(doc(db, "posts", postId));
          } catch(err) {
            console.error("刪除失敗", err);
            alert("刪除失敗！");
          }
        }
      }

      // 進行投票
      if (e.target.classList.contains('poll-option-btn')) {
        if (!currentUser) {
          alert("請先登入才能投票！");
          return;
        }
        
        const postId = e.target.getAttribute('data-post-id');
        const optionIdx = parseInt(e.target.getAttribute('data-option-idx'));
        
        try {
          // 鎖定按鈕防止連點
          e.target.disabled = true;
          e.target.innerText = '投票中...';

          const postRef = doc(db, "posts", postId);
          const postSnap = await getDoc(postRef);
          
          if (postSnap.exists()) {
            const postData = postSnap.data();
            const pollOptions = postData.pollOptions;
            
            // 防呆：再檢查一次是否投過
            let hasVoted = false;
            pollOptions.forEach(opt => {
              if (opt.votes.includes(currentUser.email)) hasVoted = true;
            });

            if (!hasVoted) {
              pollOptions[optionIdx].votes.push(currentUser.email);
              await updateDoc(postRef, { pollOptions: pollOptions });
            } else {
              alert("您已經投過票囉！");
            }
          }
        } catch(err) {
          console.error("投票失敗", err);
          alert("投票失敗，請稍後再試。");
          e.target.disabled = false;
        }
      }
    });
  }

});
