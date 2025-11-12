import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Feed3DBackground } from "@/components/Feed3DBackground";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Image, Video, Send, Heart, MessageCircle, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Post {
  id: string;
  author: string;
  avatar: string;
  content: string;
  media?: { type: "image" | "video"; url: string };
  likes: number;
  comments: number;
  timestamp: string;
}

const Feed = () => {
  const [postContent, setPostContent] = useState("");
  const [posts, setPosts] = useState<Post[]>([
    {
      id: "1",
      author: "Nguyễn Văn Minh",
      avatar: "/placeholder.svg",
      content: "Chào mọi người! Mình vừa tạo NFT đầu tiên trên F.U.Profile. Cảm giác thật tuyệt vời khi có thể lưu giữ những khoảnh khắc đáng nhớ mãi mãi trên blockchain. Công nghệ này thực sự đỉnh cao! 🚀✨ Ai cũng nên thử nhé! 💚",
      likes: 124,
      comments: 18,
      timestamp: "1 giờ trước",
    },
    {
      id: "2",
      author: "Alex Nguyen",
      avatar: "/placeholder.svg",
      content: "Just minted my first NFT on F.U.Profile! This platform is amazing for preserving life moments forever on blockchain. 🚀",
      likes: 24,
      comments: 8,
      timestamp: "2 hours ago",
    },
    {
      id: "3",
      author: "Trần Thị Hương",
      avatar: "/placeholder.svg",
      content: "Kỷ niệm 10 năm ngày cưới của vợ chồng mình! 💍💕 Đã upload tất cả ảnh cưới và những khoảnh khắc hạnh phúc lên blockchain. Cảm ơn F.U.Profile đã giúp chúng mình lưu giữ kỷ niệm này mãi mãi. Yêu thương và biết ơn! 🌸",
      media: { type: "image", url: "/placeholder.svg" },
      likes: 256,
      comments: 42,
      timestamp: "3 giờ trước",
    },
    {
      id: "4",
      author: "Sarah Chen",
      avatar: "/placeholder.svg",
      content: "Celebrating 10 years in business! Uploaded all our company milestones to the blockchain. Thanks F.U.Profile for making digital legacy possible.",
      media: { type: "image", url: "/placeholder.svg" },
      likes: 156,
      comments: 32,
      timestamp: "5 hours ago",
    },
  ]);
  const { toast } = useToast();

  const handlePost = () => {
    if (!postContent.trim()) {
      toast({
        title: "Error",
        description: "Please write something before posting",
        variant: "destructive",
      });
      return;
    }

    const newPost: Post = {
      id: Date.now().toString(),
      author: "You",
      avatar: "/placeholder.svg",
      content: postContent,
      likes: 0,
      comments: 0,
      timestamp: "Just now",
    };

    setPosts([newPost, ...posts]);
    setPostContent("");
    toast({
      title: "Success",
      description: "Your post has been published!",
    });
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <Feed3DBackground />
      <Navigation />
      
      <main className="flex-1 container mx-auto px-4 pt-24 pb-16 relative z-10">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Create Post Section */}
          <Card className="glass border-border/50 hover-lift backdrop-blur-xl bg-card/70" style={{ boxShadow: 'var(--shadow-glow), var(--shadow-card)' }}>
            <CardHeader>
              <h2 className="text-2xl font-bold text-gradient">Share Your Story</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Avatar>
                  <AvatarImage src="/placeholder.svg" />
                  <AvatarFallback>You</AvatarFallback>
                </Avatar>
                <Textarea
                  placeholder="What's on your mind? Share your life events, achievements, or thoughts..."
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  className="min-h-[100px] bg-background/50"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon">
                    <Image className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Video className="h-5 w-5" />
                  </Button>
                </div>
                <Button onClick={handlePost} variant="hero">
                  <Send className="h-4 w-4 mr-2" />
                  Post
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Feed Posts */}
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id} className="glass border-border/50 animate-fade-in hover-lift backdrop-blur-xl bg-card/70" style={{ boxShadow: 'var(--shadow-glow), var(--shadow-card)' }}>
                <CardContent className="pt-6">
                  {/* Post Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar>
                      <AvatarImage src={post.avatar} />
                      <AvatarFallback>{post.author[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{post.author}</h3>
                      <p className="text-sm text-muted-foreground">{post.timestamp}</p>
                    </div>
                  </div>

                  {/* Post Content */}
                  <p className="mb-4 text-foreground">{post.content}</p>

                  {/* Post Media */}
                  {post.media && (
                    <div className="mb-4 rounded-lg overflow-hidden">
                      {post.media.type === "image" ? (
                        <img 
                          src={post.media.url} 
                          alt="Post media" 
                          className="w-full h-auto"
                        />
                      ) : (
                        <video 
                          src={post.media.url} 
                          controls 
                          className="w-full h-auto"
                        />
                      )}
                    </div>
                  )}

                  {/* Post Actions */}
                  <div className="flex items-center gap-6 pt-4 border-t border-border/50">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Heart className="h-4 w-4" />
                      <span>{post.likes}</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <MessageCircle className="h-4 w-4" />
                      <span>{post.comments}</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Feed;
