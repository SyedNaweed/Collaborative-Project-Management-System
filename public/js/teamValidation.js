$(document).ready(function () {
  let memberProfiles = [];
  const creatorUsername = $('#creatorUsername').val();
  const creatorType = $('#creatorStudentType').val();

  // Initialize creator in member profiles
  if (creatorUsername) {
    memberProfiles.push({
      username: creatorUsername,
      studentType: creatorType,
      isCreator: true
    });
  }

  function reevaluateTeamComposition() {
    const hasInternal = memberProfiles.some((m) => m.studentType === 'INTERNAL');
    const hasExternal = memberProfiles.some((m) => m.studentType === 'EXTERNAL');
    const isMixed = hasInternal && hasExternal;

    const mixedAlertBox = $('#mixedTeamCallout');
    const confirmCheckbox = $('#collaborationConfirmed');

    if (isMixed) {
      mixedAlertBox.slideDown(250);
      confirmCheckbox.prop('required', true);
    } else {
      mixedAlertBox.slideUp(250);
      confirmCheckbox.prop('required', false);
      confirmCheckbox.prop('checked', false);
    }

    $('#totalMembersCount').text(memberProfiles.length);

    // Render Member Badges Table
    const listContainer = $('#membersListTable tbody');
    listContainer.empty();

    memberProfiles.forEach(function (m, idx) {
      const typeBadge =
        m.studentType === 'INTERNAL'
          ? '<span class="badge badge-role badge-internal">Internal</span>'
          : '<span class="badge badge-role badge-external">External</span>';

      const regNoDisplay = m.registerNumber ? `<code class="text-primary">${m.registerNumber}</code>` : '<em class="text-muted">Not applicable (External)</em>';
      const creatorBadge = m.isCreator ? '<span class="badge bg-secondary ms-1">Team Creator</span>' : '';
      const removeBtn = m.isCreator
        ? ''
        : `<button type="button" class="btn btn-sm btn-outline-danger btn-remove-member" data-index="${idx}"><i class="bi bi-trash"></i></button>`;

      listContainer.append(`
        <tr>
          <td><strong>${m.username}</strong> ${creatorBadge}</td>
          <td>${m.fullName || '-'}</td>
          <td>${typeBadge}</td>
          <td>${regNoDisplay}</td>
          <td class="text-end">${removeBtn}</td>
        </tr>
      `);
    });
  }

  // Initial evaluation with creator
  reevaluateTeamComposition();

  // Add Member by Username
  $('#btnAddMember').on('click', function () {
    const input = $('#memberUsernameInput');
    const username = input.val().trim().toLowerCase();
    const errorBox = $('#memberAddError');
    errorBox.text('');

    if (!username) {
      errorBox.text('Please enter a student username.');
      return;
    }

    if (memberProfiles.some((m) => m.username.toLowerCase() === username)) {
      errorBox.text('Student is already added to this team.');
      return;
    }

    if (memberProfiles.length >= 9) {
      errorBox.text('Maximum team limit of 9 students reached.');
      return;
    }

    const $btn = $(this);
    $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Checking...');

    $.ajax({
      url: '/auth/check-student',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ username }),
      success: function (res) {
        $btn.prop('disabled', false).html('<i class="bi bi-person-plus"></i> Add Member');
        input.val('');
        const student = res.student;
        memberProfiles.push({
          username: student.username,
          fullName: student.fullName,
          studentType: student.studentType,
          registerNumber: student.registerNumber,
          isCreator: false
        });
        reevaluateTeamComposition();
      },
      error: function (xhr) {
        $btn.prop('disabled', false).html('<i class="bi bi-person-plus"></i> Add Member');
        const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'Student not found.';
        errorBox.text(msg);
      }
    });
  });

  // Remove member
  $(document).on('click', '.btn-remove-member', function () {
    const index = $(this).data('index');
    memberProfiles.splice(index, 1);
    reevaluateTeamComposition();
  });

  // Team Form Submit
  $('#createTeamForm').on('submit', function (e) {
    e.preventDefault();
    const form = $(this);
    const alertBox = $('#teamFormAlert');
    alertBox.addClass('d-none').text('');
    $('.is-invalid').removeClass('is-invalid');

    const facultyId = $('#facultySelect').val();
    const teamName = $('#teamName').val();
    const collaborationConfirmed = $('#collaborationConfirmed').is(':checked');

    if (memberProfiles.length < 1 || memberProfiles.length > 9) {
      alertBox.removeClass('alert-success d-none').addClass('alert alert-danger d-block');
      alertBox.text('Team size must be between 1 and 9 members.');
      return;
    }

    const payload = {
      name: teamName,
      facultyId: facultyId,
      memberUsernames: memberProfiles.filter((m) => !m.isCreator).map((m) => m.username),
      collaborationConfirmed: collaborationConfirmed
    };

    const submitBtn = form.find('button[type="submit"]');
    submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Creating Team...');

    $.ajax({
      url: '/student/create-team',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(payload),
      success: function (res) {
        alertBox.removeClass('alert-danger d-none').addClass('alert alert-success d-block');
        alertBox.html(`<strong>Success!</strong> ${res.message}`);
        setTimeout(function () {
          window.location.href = res.redirectUrl || '/student/dashboard';
        }, 1200);
      },
      error: function (xhr) {
        submitBtn.prop('disabled', false).html('<i class="bi bi-shield-check"></i> Finalize Team Creation');
        const data = xhr.responseJSON;
        if (data && data.errors) {
          if (data.errors.collaborationConfirmed) {
            $('#mixedTeamCallout').addClass('border-danger');
            $('#collaborationConfirmedError').text(data.errors.collaborationConfirmed);
          }
          if (data.errors.name) {
            $('#teamName').addClass('is-invalid');
            $('#teamNameError').text(data.errors.name);
          }
          if (data.errors.facultyId) {
            $('#facultySelect').addClass('is-invalid');
            $('#facultySelectError').text(data.errors.facultyId);
          }
          if (data.errors.members) {
            alertBox.removeClass('alert-success d-none').addClass('alert alert-danger d-block');
            alertBox.text(data.errors.members);
          }
        } else {
          alertBox.removeClass('alert-success d-none').addClass('alert alert-danger d-block');
          alertBox.text((data && data.message) || 'Error creating team.');
        }
      }
    });
  });
});
