import { useState } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Filter, 
  Plus, 
  MoreHorizontal,
  ArrowUpDown,
  Eye,
  Play,
  FileText,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ScoreBadge } from '@/components/ui/score-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { RoleBadge } from '@/components/ui/role-badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import type { JobRole, InterviewStatus } from '@/types/database';

interface CandidateRow {
  id: string;
  name: string;
  email: string;
  role: JobRole;
  atsScore: number;
  interviewStatus: InterviewStatus;
  appliedDate: string;
}

const mockCandidates: CandidateRow[] = [
  { id: '1', name: 'Sarah Johnson', email: 'sarah@example.com', role: 'salesforce_developer', atsScore: 87, interviewStatus: 'completed', appliedDate: '2024-01-15' },
  { id: '2', name: 'Michael Chen', email: 'michael@example.com', role: 'qa_engineer', atsScore: 72, interviewStatus: 'in_progress', appliedDate: '2024-01-14' },
  { id: '3', name: 'Emily Davis', email: 'emily@example.com', role: 'business_analyst', atsScore: 91, interviewStatus: 'completed', appliedDate: '2024-01-13' },
  { id: '4', name: 'James Wilson', email: 'james@example.com', role: 'salesforce_developer', atsScore: 65, interviewStatus: 'pending', appliedDate: '2024-01-12' },
  { id: '5', name: 'Lisa Anderson', email: 'lisa@example.com', role: 'qa_engineer', atsScore: 78, interviewStatus: 'pending', appliedDate: '2024-01-11' },
  { id: '6', name: 'Robert Taylor', email: 'robert@example.com', role: 'business_analyst', atsScore: 84, interviewStatus: 'in_progress', appliedDate: '2024-01-10' },
];

export default function CandidatesPage() {
  const { loading } = useRequireAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates] = useState<CandidateRow[]>(mockCandidates);

  const filteredCandidates = candidates.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl lg:text-3xl font-bold"
            >
              Candidates
            </motion.h1>
            <p className="text-muted-foreground mt-1">
              Manage and review all candidate applications
            </p>
          </div>
          <Button asChild>
            <Link to="/candidates/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Candidate
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search candidates..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
              <Button variant="outline">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Sort
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>ATS Score</TableHead>
                  <TableHead>Interview Status</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.map((candidate, index) => (
                  <motion.tr
                    key={candidate.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {candidate.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{candidate.name}</p>
                          <p className="text-sm text-muted-foreground">{candidate.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={candidate.role} size="sm" />
                    </TableCell>
                    <TableCell>
                      <ScoreBadge score={candidate.atsScore} showLabel />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={candidate.interviewStatus} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(candidate.appliedDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileText className="mr-2 h-4 w-4" />
                            View Resume
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Play className="mr-2 h-4 w-4" />
                            Start Interview
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
