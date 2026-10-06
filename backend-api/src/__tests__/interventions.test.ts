import { CAUSE_CODES } from '../validators/interventions.validator';
import * as svc from '../services/interventions.service';

// Unit test: cause codes are well-defined
describe('Intervention Validator', () => {
  it('should have exactly 3 cause codes', () => {
    expect(CAUSE_CODES).toHaveLength(3);
  });

  it('cause codes should match expected values', () => {
    expect(CAUSE_CODES).toContain('ATTENDANCE_DECLINE');
    expect(CAUSE_CODES).toContain('ASSESSMENT_UNDERPERFORMANCE');
    expect(CAUSE_CODES).toContain('FEEDBACK_CONCERN');
  });
});

// Service module structure tests
describe('Intervention Service exports', () => {
  it('should export core functions', () => {
    expect(typeof svc.createIntervention).toBe('function');
    expect(typeof svc.getInterventionById).toBe('function');
    expect(typeof svc.listInterventions).toBe('function');
    expect(typeof svc.updateIntervention).toBe('function');
    expect(typeof svc.completeIntervention).toBe('function');
    expect(typeof svc.editOutcome).toBe('function');
    expect(typeof svc.findActiveIntervention).toBe('function');
    expect(typeof svc.getPendingCount).toBe('function');
  });

  it('should export task functions', () => {
    expect(typeof svc.createTask).toBe('function');
    expect(typeof svc.updateTask).toBe('function');
    expect(typeof svc.getTaskById).toBe('function');
  });

  it('should export note functions', () => {
    expect(typeof svc.createNote).toBe('function');
    expect(typeof svc.updateNote).toBe('function');
    expect(typeof svc.deleteNote).toBe('function');
    expect(typeof svc.getNoteById).toBe('function');
  });
});

// Permission catalog integration
describe('Permission catalog', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PERMISSIONS, ROLE_PERMISSIONS } = require('../prisma/permission-catalog');

  it('should have intervention permission codes', () => {
    const codes = PERMISSIONS.map((p: { code: string }) => p.code);
    expect(codes).toContain('interventions:create:assigned');
    expect(codes).toContain('interventions:update:own');
    expect(codes).toContain('interventions:log_outcome:own');
    expect(codes).toContain('interventions:read:own');
    expect(codes).toContain('interventions:read:assigned');
    expect(codes).toContain('interventions:read:any');
  });

  it('MENTOR should have create, update, log_outcome, read:assigned', () => {
    const mentorPerms: string[] = ROLE_PERMISSIONS.MENTOR;
    expect(mentorPerms).toContain('interventions:create:assigned');
    expect(mentorPerms).toContain('interventions:update:own');
    expect(mentorPerms).toContain('interventions:log_outcome:own');
    expect(mentorPerms).toContain('interventions:read:assigned');
  });

  it('STUDENT should only have read:own', () => {
    const studentPerms: string[] = ROLE_PERMISSIONS.STUDENT;
    expect(studentPerms).toContain('interventions:read:own');
    expect(studentPerms).not.toContain('interventions:create:assigned');
    expect(studentPerms).not.toContain('interventions:update:own');
    expect(studentPerms).not.toContain('interventions:log_outcome:own');
  });

  it('FACULTY should have read:any and no write permissions', () => {
    const facultyPerms: string[] = ROLE_PERMISSIONS.FACULTY;
    expect(facultyPerms).toContain('interventions:read:any');
    expect(facultyPerms).not.toContain('interventions:create:assigned');
    expect(facultyPerms).not.toContain('interventions:update:own');
  });

  it('ADMIN should have read:any and no write permissions', () => {
    const adminPerms: string[] = ROLE_PERMISSIONS.ADMIN;
    expect(adminPerms).toContain('interventions:read:any');
    expect(adminPerms).not.toContain('interventions:create:assigned');
    expect(adminPerms).not.toContain('interventions:update:own');
  });

  it('TRAINER should not have intervention permissions', () => {
    const trainerPerms: string[] = ROLE_PERMISSIONS.TRAINER;
    const interventionPerms = trainerPerms.filter((p: string) => p.startsWith('interventions:'));
    expect(interventionPerms).toHaveLength(0);
  });

  it('COORDINATOR should not have intervention permissions', () => {
    const coordPerms: string[] = ROLE_PERMISSIONS.COORDINATOR;
    const interventionPerms = coordPerms.filter((p: string) => p.startsWith('interventions:'));
    expect(interventionPerms).toHaveLength(0);
  });

  it('notification:update:own should be given to all notification-reading roles', () => {
    for (const role of ['STUDENT', 'TRAINER', 'FACULTY', 'MENTOR', 'COORDINATOR', 'ADMIN']) {
      const perms: string[] = ROLE_PERMISSIONS[role];
      if (perms.includes('notifications:read:own')) {
        expect(perms).toContain('notifications:update:own');
      }
    }
  });
});
